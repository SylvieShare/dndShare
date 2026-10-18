// Annotate accepted packed models. Geometry, painting and all placement stay exact.
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { initializeStructureReferences } from "./medieval_source_reference.mjs";
import { addModelWaterMask } from "./model_water_mask.mjs";
import { localModelAsset } from "./local_model_assets.mjs";
import {
  triangleFingerprint,
  materialImages,
} from "./model_flame_geometry.mjs";

const require = createRequire("/private/tmp/dndshare-model-tools/package.json"),
  { NodeIO } = require("@gltf-transform/core"),
  { ALL_EXTENSIONS } = require("@gltf-transform/extensions"),
  { MeshoptEncoder, MeshoptDecoder } = require("meshoptimizer");
await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready]);
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    "meshopt.encoder": MeshoptEncoder,
    "meshopt.decoder": MeshoptDecoder,
  });
const code = process.argv[2];
if (code !== "MT1-032")
  throw Error("Only the measured fountain prototype is supported");
const root = path.resolve(import.meta.dirname, "../.."),
  base = path.join(root, "models/collections/medieval-town-vol1"),
  review = path.join(base, "review", code),
  directory = path.join(base, "water-animation", code),
  before = path.join(directory, "before"),
  recipe = JSON.parse(
    await fs.readFile(
      path.join(import.meta.dirname, "medieval-recipes", code + ".json"),
      "utf8",
    ),
  ),
  hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
await fs.mkdir(before, { recursive: true });
// An immutable baseline also retains the original native-paint QA chain.
try {
  await fs.copyFile(
    path.join(review, "report.json"),
    path.join(before, "report.json"),
    1,
  );
} catch (e) {
  if (e.code !== "EEXIST") throw e;
}
const report = JSON.parse(
  await fs.readFile(path.join(before, "report.json"), "utf8"),
);
await initializeStructureReferences(
  recipe.materials,
  path.join(base, "inventory.json"),
);
const assets = { ...report.model.assets },
  tiers = {};
const upload = path.join(directory, "upload");
await fs.mkdir(upload, { recursive: true });
for (const tier of ["render", "lod"]) {
  try {
    await fs.copyFile(
      path.join(review, tier + ".glb"),
      path.join(before, tier + ".glb"),
      1,
    );
  } catch (e) {
    if (e.code !== "EEXIST") throw e;
  }
  const input = await fs.readFile(path.join(before, tier + ".glb"));
  assert.equal(hash(input), assets[tier].sha256);
  const doc = await io.readBinary(input),
    fingerprint = triangleFingerprint(doc),
    images = materialImages(doc),
    counts = addModelWaterMask(
      doc,
      recipe.materials,
      recipe.mountDepthMM - report.model.mountDepth * 35,
    ),
    bytes = await io.writeBinary(doc),
    decoded = await io.readBinary(bytes);
  assert.equal(
    triangleFingerprint(decoded, ["_WATER"]),
    fingerprint,
    "Body attributes changed",
  );
  assert.deepEqual(materialImages(decoded), images, "Painting changed");
  assert.equal(
    triangleFingerprint(decoded),
    triangleFingerprint(doc),
    "Water mask changed during compression",
  );
  await fs.writeFile(path.join(directory, tier + ".glb"), bytes);
  const sha256 = hash(bytes);
  assets[tier] = {
    ...assets[tier],
    key: "map-models/" + sha256 + ".glb",
    sha256,
    size: bytes.length,
  };
  await fs.writeFile(path.join(upload, sha256 + ".glb"), bytes);
  tiers[tier] = {
    ...counts,
    sha256,
    bytes: bytes.length,
    bodyIdentical: true,
    texturesIdentical: true,
  };
  console.log(code, tier, JSON.stringify(tiers[tier]));
}
const model = { ...report.model, assets };
for (const role of ["source", "shadow", "preview"]) {
  const source = await localModelAsset(assets[role]);
  const bytes = await fs.readFile(source);
  assert.equal(hash(bytes), assets[role].sha256);
  await fs.writeFile(path.join(upload, path.basename(assets[role].key)), bytes);
}
await fs.copyFile(
  path.join(review, "shadow.glb"),
  path.join(directory, "shadow.glb"),
);
const result = {
  ...report,
  model,
  recipe,
  publication: null,
  tiers: Object.fromEntries(
    Object.entries(report.tiers).map(([tier, value]) => [
      tier,
      { ...value, ...(assets[tier] ? { bytes: assets[tier].size } : {}) },
    ]),
  ),
  waterAnimation: { before: report.model.assets, tiers },
  runtimeBytes: ["render", "lod", "shadow", "preview"].reduce(
    (n, role) => n + assets[role].size,
    0,
  ),
};
await fs.writeFile(
  path.join(directory, "report.json"),
  JSON.stringify(result, null, 2) + "\n",
);
await fs.writeFile(
  path.join(upload, "catalogue.json"),
  JSON.stringify([model], null, 2) + "\n",
);
