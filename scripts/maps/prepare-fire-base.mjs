// Convert one accepted torch/camp body, keeping geometry attributes and paint exact.
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { lightBaseDirectory } from "./light_base_context.mjs";
import { fireLightDomain } from "./fire_light_domains.mjs";
import {
  stripMeasuredFlames,
  triangleFingerprint,
  materialImages,
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
const code = process.argv[2],
  directory = lightBaseDirectory(code),
  report = JSON.parse(
    await fs.readFile(path.join(directory, "before/report.json"), "utf8"),
  ),
  domain = await fireLightDomain(code, report),
  tiers = {};
const defaultLights =
  code === "LC-079" ? [domain.recipe.torch.light] : domain.recipe.defaultLights;
assert.ok(defaultLights?.every((l) => l.effect?.kind === "fire"));
for (const tier of ["render", "lod"]) {
  const bytes = await fs.readFile(
    path.join(directory, "before", tier + ".glb"),
  );
  assert.equal(
    createHash("sha256").update(bytes).digest("hex"),
    report.model.assets[tier].sha256,
  );
  const doc = await io.readBinary(bytes),
    images = materialImages(doc),
    result = stripMeasuredFlames(doc, domain.matches, domain.shift),
    fingerprint = triangleFingerprint(doc);
  await doc.transform(prune({ keepAttributes: true }));
  const output = await io.writeBinary(doc),
    decoded = await io.readBinary(output);
  assert.equal(
    triangleFingerprint(decoded),
    fingerprint,
    "Surviving geometry/UV/normals changed",
  );
  assert.deepEqual(materialImages(decoded), images, "Body painting changed");
  await fs.writeFile(path.join(directory, tier + ".glb"), output);
  tiers[tier] = {
    ...result,
    bytes: output.length,
    triangles: result.counts.reduce((n, p) => n + p.after, 0),
    sha256: createHash("sha256").update(output).digest("hex"),
    retainedVertexDataIdentical: true,
    bodyTexturesIdentical: true,
  };
  console.log(code, tier, JSON.stringify(tiers[tier]));
}
const shadow = await prepareShadow(
  path.join(directory, "lod.glb"),
  path.join(directory, "shadow.glb"),
);
tiers.shadow = { bytes: shadow.asset.size, triangles: shadow.triangles };
const checks = {
  clearDirections: [
    [1, 0, 0],
    [-1, 0, 0],
    [0, 0, 1],
    [0, 0, -1],
    [0, 1, 0],
  ],
  clearDistance: 0.03,
  blockedDirection: code.startsWith("UD-") ? [1, 0, 0] : [0, -1, 0],
  blockedDistance: 3,
};
await fs.writeFile(
  path.join(directory, "report.json"),
  JSON.stringify(
    {
      ...report,
      recipe: { ...domain.recipe, defaultLights, lightShadowChecks: checks },
      publication: null,
      proceduralFire: {
        before: report.model.assets,
        tiers,
        domainEvidence: domain.evidence,
      },
      tiers,
    },
    null,
    2,
  ) + "\n",
);
