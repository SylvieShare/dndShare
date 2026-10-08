import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { reviewCollection } from "./review_collection.mjs";
import { localModelAsset } from "./local_model_assets.mjs";
const code = process.argv[2];
import specs from "./toxic_sewer_recipes.mjs";
const spec = specs[code];
if (!spec) throw new Error("One measured Toxic Sewer recipe required");
const review = reviewCollection("toxic-sewer");
const registry = JSON.parse(await fs.readFile(review.snapshot, "utf8"));
const model = registry.filter(
  (m) =>
    m.collection === review.collection &&
    m.sourceCode === code &&
    m.sourceName === spec.sourceName,
)[0];
if (!model) throw new Error("Refresh the MCP registry: accepted model missing");
const rows = JSON.parse(
  await fs.readFile(path.join(review.base, "manifest.json"), "utf8"),
);
const source = rows.find(
  (m) =>
    m.collection === review.collection &&
    m.code === code &&
    m.sourceName === spec.sourceName,
);
if (!source || source.sourceSHA256 !== model.assets.source.sha256)
  throw new Error("Canonical unsupported STL differs from accepted source");
const sourcePath = path.resolve(review.base, "..", source.sourcePath);
if (
  createHash("sha256")
    .update(await fs.readFile(sourcePath))
    .digest("hex") !== model.assets.source.sha256
)
  throw new Error("Source STL bytes differ from the immutable archive");
const directory = path.join(
  review.detail,
  code,
  `${code.replaceAll(" ", "_")}__v${model.assets.render.sha256.slice(0, 12)}`,
);
await fs.mkdir(directory, { recursive: true });
const require = createRequire("/private/tmp/dndshare-model-tools/package.json");
const { NodeIO } = require("@gltf-transform/core"),
  { ALL_EXTENSIONS } = require("@gltf-transform/extensions");
const { dequantize, getBounds } = require("@gltf-transform/functions"),
  { MeshoptDecoder } = require("meshoptimizer");
await MeshoptDecoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ "meshopt.decoder": MeshoptDecoder });
let bounds;
for (const tier of ["render", "lod"]) {
  const doc = await io.read(await localModelAsset(model.assets[tier]));
  if (tier === "render") bounds = getBounds(doc.getRoot().listScenes()[0]);
  await doc.transform(dequantize());
  for (const ext of doc.getRoot().listExtensionsUsed())
    if (ext.extensionName === "EXT_meshopt_compression") ext.dispose();
  await io.write(path.join(directory, tier + "-input.glb"), doc);
}
const report = {
  model: { ...model, textureDetail: "detailed" },
  recipe: "toxic-sewer-individual-v1",
  sourcePath,
  cutHeight: source.cutHeight,
  sourceShiftMM: [
    (bounds.min[0] + bounds.max[0]) * 17.5 -
      (source.min[0] + source.max[0]) / 2,
    -(bounds.min[2] + bounds.max[2]) * 17.5 -
      (source.min[1] + source.max[1]) / 2,
  ],
  materialSpec: spec,
  weightBudget: spec.weightBudget,
  tiers: {},
  geometry:
    "Body rebuilt from original unsupported sculpt before UV; accepted insertion pegs and placement retained",
};
const file = path.join(directory, "report.json");
await fs.writeFile(file, JSON.stringify(report, null, 2) + "\n");
console.log("TOXIC_SEWER_PREPARED", file);
