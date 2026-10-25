// An accepted painted model becomes an unlit body for a procedural light effect.
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { initializeStructureReferences } from "./medieval_source_reference.mjs";
import {
  stripSculptedFlames,
  materialImages,
  triangleFingerprint,
} from "./model_flame_geometry.mjs";
import { prepareShadow } from "./shadow_model.mjs";

const require = createRequire("/private/tmp/dndshare-model-tools/package.json"),
  { NodeIO } = require("@gltf-transform/core"),
  { ALL_EXTENSIONS } = require("@gltf-transform/extensions"),
  { prune } = require("@gltf-transform/functions"),
  { MeshoptEncoder, MeshoptDecoder } = require("meshoptimizer");
await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready]);
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    "meshopt.encoder": MeshoptEncoder,
    "meshopt.decoder": MeshoptDecoder,
  });
const code = process.argv[2];
if (!/^MT1-\d{3}$/.test(code || "")) throw Error("One model code required");
const base = path.resolve(
    import.meta.dirname,
    "../../models/collections/medieval-town-vol1",
  ),
  directory = path.join(base, "light-effects", code),
  before = path.join(directory, "before"),
  report = JSON.parse(
    await fs.readFile(path.join(before, "report.json"), "utf8"),
  ),
  recipe = JSON.parse(
    await fs.readFile(
      path.join(import.meta.dirname, "medieval-recipes", code + ".json"),
      "utf8",
    ),
  );
await initializeStructureReferences(
  recipe.materials,
  path.join(base, "inventory.json"),
);
const tiers = {};
for (const tier of ["render", "lod"]) {
  const input = await fs.readFile(path.join(before, tier + ".glb"));
  assert.equal(
    createHash("sha256").update(input).digest("hex"),
    report.model.assets[tier].sha256,
  );
  const doc = await io.readBinary(input),
    images = materialImages(doc),
    result = stripSculptedFlames(
      doc,
      recipe.materials,
      recipe.mountDepthMM - report.model.mountDepth * 35,
      tier,
      recipe.mountCenterMM,
    ),
    expected = triangleFingerprint(doc);
  await doc.transform(prune({ keepAttributes: true }));
  const bytes = await io.writeBinary(doc),
    decoded = await io.readBinary(bytes);
  assert.equal(
    triangleFingerprint(decoded),
    expected,
    "Retained geometry/UV/normals changed",
  );
  assert.deepEqual(materialImages(decoded), images, "Body paint changed");
  assert.ok(
    decoded
      .getRoot()
      .listMaterials()
      .every(
        (m) =>
          !m.getEmissiveTexture() &&
          m.getEmissiveFactor().every((v) => v === 0),
      ),
  );
  await fs.writeFile(path.join(directory, tier + ".glb"), bytes);
  tiers[tier] = {
    ...result,
    bytes: bytes.length,
    triangles: result.counts.reduce((n, c) => n + c.after, 0),
    retainedVertexDataIdentical: true,
    bodyTexturesIdentical: true,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
  console.log(code, tier, JSON.stringify(tiers[tier]));
}
const shadow = await prepareShadow(
  path.join(directory, "lod.glb"),
  path.join(directory, "shadow.glb"),
);
tiers.shadow = { bytes: shadow.asset.size, triangles: shadow.triangles };
await fs.writeFile(
  path.join(directory, "report.json"),
  JSON.stringify(
    {
      ...report,
      model: report.model,
      recipe,
      proceduralFire: { before: report.model.assets, tiers },
      tiers,
    },
    null,
    2,
  ) + "\n",
);
