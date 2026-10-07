import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import specs from "./lost_cave_recipes.mjs";
import { reviewCollection } from "./review_collection.mjs";
import { localModelAsset } from "./local_model_assets.mjs";
const code = process.argv[2],
  spec = specs[code];
if (!spec)
  throw new Error("One individually reviewed Lost Cave recipe required");
const review = reviewCollection("lost-cave"),
  registry = JSON.parse(await fs.readFile(review.snapshot, "utf8")),
  model = registry
    .filter((m) => m.sourceCode === code && m.sourceName === spec.sourceName)
    .sort((a, b) => b.version - a.version)[0];
if (!model || model.textureDetail === "detailed")
  throw new Error("Missing or already reviewed model");
if (!spec.groupCode || model.code !== spec.groupCode)
  throw new Error("Review the current logical model family code before preparing");
const rows = JSON.parse(
    await fs.readFile(path.join(review.base, "manifest.json"), "utf8"),
  ),
  source = rows.find(
    (m) =>
      m.collection === review.collection &&
      m.code === code &&
      m.sourceName === spec.sourceName,
  );
if (source.sourceSHA256 !== model.assets.source.sha256)
  throw new Error("Canonical STL differs from accepted source");
const directory = path.join(
  review.detail,
  code,
  `${code}__${spec.sourceName.replace(/[^a-z0-9]+/gi, "_")}__${model.version}`,
);
await fs.mkdir(directory, { recursive: true });
const require = createRequire("/private/tmp/dndshare-model-tools/package.json"),
  { NodeIO } = require("@gltf-transform/core"),
  { ALL_EXTENSIONS } = require("@gltf-transform/extensions"),
  { dequantize, getBounds } = require("@gltf-transform/functions"),
  { MeshoptDecoder } = require("meshoptimizer");
await MeshoptDecoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ "meshopt.decoder": MeshoptDecoder });
let acceptedBounds;
for (const tier of ["render", "lod"]) {
  const doc = await io.read(await localModelAsset(model.assets[tier]));
  if (tier === "render")
    acceptedBounds = getBounds(doc.getRoot().listScenes()[0]);
  await doc.transform(dequantize());
  for (const ext of doc.getRoot().listExtensionsUsed())
    if (ext.extensionName === "EXT_meshopt_compression") ext.dispose();
  await io.write(path.join(directory, tier + "-input.glb"), doc);
}
const report = {
  model: { ...model, textureDetail: "detailed" },
  recipe: "lost-cave-individual-v1",
  sourcePath: path.resolve(review.base, "..", source.sourcePath),
  cutHeight: source.cutHeight,
  sourceShiftMM: [
    (acceptedBounds.min[0] + acceptedBounds.max[0]) * 17.5 -
      (source.min[0] + source.max[0]) / 2,
    -(acceptedBounds.min[2] + acceptedBounds.max[2]) * 17.5 -
      (source.min[1] + source.max[1]) / 2,
  ],
  materialSpec: spec,
  weightBudget: spec.weightBudget,
  geometry:
    "accepted geometry and UV retained; relief and AO rebaked from original STL",
  tiers: {},
};
await fs.writeFile(
  path.join(directory, "report.json"),
  JSON.stringify(report, null, 2) + "\n",
);
console.log("LOST_CAVE_PREPARED", path.join(directory, "report.json"));
