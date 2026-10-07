import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { localModelAsset } from "./local_model_assets.mjs";
import { textureDimensions } from "./texture_dimensions.mjs";
const file = process.argv[2];
if (!file) throw new Error("One reviewed report path required");
const report = JSON.parse(await fs.readFile(file, "utf8")),
  directory = path.dirname(path.resolve(file));
const require = createRequire("/private/tmp/dndshare-model-tools/package.json"),
  sharp = require("sharp"),
  { NodeIO } = require("@gltf-transform/core"),
  { ALL_EXTENSIONS } = require("@gltf-transform/extensions"),
  { getBounds } = require("@gltf-transform/functions"),
  { MeshoptDecoder } = require("meshoptimizer");
await MeshoptDecoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ "meshopt.decoder": MeshoptDecoder });
report.resourceMetrics = {};
report.resourceMetrics.source = {
  bytes: report.model.assets.source.size,
  sha256: report.model.assets.source.sha256,
  archive: true,
};
for (const tier of ["render", "lod", "shadow"]) {
  const resource =
      tier === "shadow"
        ? report.preparedShadow
          ? path.join(directory, path.basename(report.preparedShadow.asset.key))
          : await localModelAsset(report.model.assets.shadow)
        : path.join(directory, tier + ".glb"),
    bytes = await fs.readFile(resource),
    doc = await io.readBinary(bytes);
  const triangles = doc
    .getRoot()
    .listMeshes()
    .reduce(
      (sum, m) =>
        sum +
        m
          .listPrimitives()
          .reduce(
            (n, p) =>
              n +
              (p.getIndices()?.getCount() ||
                p.getAttribute("POSITION").getCount()) /
                3,
            0,
          ),
      0,
    );
  const maps = [];
  for (const mat of doc.getRoot().listMaterials())
    for (const slot of ["BaseColor", "Normal", "MetallicRoughness"]) {
      const texture = mat["get" + slot + "Texture"]();
      if (!texture) continue;
      const data = Buffer.from(texture.getImage()),
        meta = await textureDimensions(data, texture.getMimeType());
      maps.push({
        slot,
        width: meta.width,
        height: meta.height,
        format: texture.getMimeType(),
        bytes: data.length,
      });
    }
  report.resourceMetrics[tier] = {
    bytes: bytes.length,
    triangles,
    bounds: getBounds(doc.getRoot().listScenes()[0]),
    maps,
    ...(tier === "shadow"
      ? {
          reused: !report.preparedShadow,
          sha256: (report.preparedShadow?.asset ?? report.model.assets.shadow)
            .sha256,
        }
      : {}),
  };
  if (
    tier === "shadow" &&
    (doc.getRoot().listTextures().length ||
      doc.getRoot().listMaterials().length)
  )
    throw new Error("Expected verified texture-free shadow geometry");
}
const preview = await sharp(path.join(directory, "preview.png"))
  .webp({ quality: 88 })
  .toBuffer();
report.resourceMetrics.preview = {
  bytes: preview.length,
  width: (await sharp(preview).metadata()).width,
  format: "image/webp",
};
await fs.writeFile(file, JSON.stringify(report, null, 2) + "\n");
console.log(
  "MODEL_METRICS",
  report.model.sourceCode,
  Object.fromEntries(
    Object.entries(report.resourceMetrics).map(([k, v]) => [
      k,
      { bytes: v.bytes, triangles: v.triangles },
    ]),
  ),
);
