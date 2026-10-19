// Metrics for the actual decoded publication bytes, including KTX2 images.
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire("/private/tmp/dndshare-model-tools/package.json"),
  { NodeIO } = require("@gltf-transform/core"),
  { ALL_EXTENSIONS } = require("@gltf-transform/extensions"),
  { getBounds } = require("@gltf-transform/functions"),
  { MeshoptDecoder } = require("meshoptimizer"),
  sharp = require("sharp");
await MeshoptDecoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ "meshopt.decoder": MeshoptDecoder });
const directory = path.resolve(process.argv[2]);
const report = JSON.parse(
  await fs.readFile(path.join(directory, "report.json"), "utf8"),
);
report.resourceMetrics = {};
for (const tier of ["render", "lod", "shadow"]) {
  const doc = await io.read(path.join(directory, tier + ".glb"));
  const triangles = doc
    .getRoot()
    .listMeshes()
    .reduce(
      (n, m) =>
        n +
        m
          .listPrimitives()
          .reduce((n, p) => n + p.getIndices().getCount() / 3, 0),
      0,
    );
  report.resourceMetrics[tier] = {
    triangles,
    bounds: getBounds(doc.getRoot().listScenes()[0]),
  };
  const texture = doc
    .getRoot()
    .listMaterials()
    .find((m) => m.getBaseColorTexture())
    ?.getBaseColorTexture();
  if (texture) {
    const bytes = Buffer.from(texture.getImage());
    report.tiers[tier].textureSize =
      texture.getMimeType() === "image/ktx2"
        ? bytes.readUInt32LE(20)
        : (await sharp(bytes).metadata()).width;
    report.tiers[tier].textureCount = doc.getRoot().listTextures().length;
  }
}
await fs.writeFile(
  path.join(directory, "report.json"),
  JSON.stringify(report, null, 2) + "\n",
);
console.log(
  report.model.sourceCode,
  "RESOURCE_METRICS",
  JSON.stringify(report.resourceMetrics),
);
