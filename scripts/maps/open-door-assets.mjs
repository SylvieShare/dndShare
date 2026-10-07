import fs from "node:fs/promises";
import { createRequire } from "node:module";
import { rasterizeSurface, extendUvGutters } from "./uv_surface.mjs";
const require = createRequire("/private/tmp/dndshare-model-tools/package.json");
const { NodeIO } = require("@gltf-transform/core"),
  { ALL_EXTENSIONS } = require("@gltf-transform/extensions"),
  { meshopt, dequantize } = require("@gltf-transform/functions"),
  { MeshoptEncoder, MeshoptDecoder } = require("meshoptimizer");
const sharp = require("sharp");
await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready]);
export const doorIO = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    "meshopt.encoder": MeshoptEncoder,
    "meshopt.decoder": MeshoptDecoder,
  });
export async function prepareDoorTier(input, output, preview, size, step = 1) {
  const doc = await doorIO.read(input),
    root = doc.getRoot(),
    originalMaps = root.listMaterials().map((m) => m.getBaseColorTexture());
  let black = 0;
  for (const texture of new Set(originalMaps.filter(Boolean))) {
    const meta = await sharp(Buffer.from(texture.getImage())).metadata(),
      width = Math.min(meta.width, size),
      height = Math.min(meta.height, size);
    let { data, info } = await sharp(Buffer.from(texture.getImage()))
      .resize(width, height)
      .raw()
      .toBuffer({ resolveWithObject: true });
    for (let i = 0; i < originalMaps.length; i++)
      root
        .listMaterials()
        [i].setBaseColorTexture(originalMaps[i] === texture ? texture : null);
    const coverage = rasterizeSurface(doc, width, height, (i) => {
      if (
        Math.max(...data.subarray(i * info.channels, i * info.channels + 3)) < 4
      )
        black++;
    });
    for (let i = 0; i < originalMaps.length; i++)
      root.listMaterials()[i].setBaseColorTexture(originalMaps[i]);
    if (black) throw new Error("Black albedo pixels on opened door: " + black);
    extendUvGutters(data, info.channels, coverage, width, height, 8);
    texture.setImage(
      await sharp(data, { raw: info }).png({ compressionLevel: 9 }).toBuffer(),
    );
  }
  if (step > 1)
    for (const texture of new Set(
      root
        .listMaterials()
        .map((m) => m.getMetallicRoughnessTexture())
        .filter(Boolean),
    )) {
      const { data, info } = await sharp(Buffer.from(texture.getImage()))
        .raw()
        .toBuffer({ resolveWithObject: true });
      for (let i = 1; i < data.length; i += info.channels)
        data[i] = Math.min(255, Math.round(data[i] / step) * step);
      texture.setImage(
        await sharp(data, { raw: info })
          .png({ compressionLevel: 9 })
          .toBuffer(),
      );
    }
  await doorIO.write(preview, doc);
  await doc.transform(
    meshopt({
      encoder: MeshoptEncoder,
      level: "medium",
      quantizePosition: 16,
      quantizeNormal: 12,
      quantizeTexcoord: 16,
    }),
  );
  const bytes = await doorIO.writeBinary(doc);
  await fs.writeFile(output, bytes);
  const decoded = await doorIO.readBinary(bytes);
  await decoded.transform(dequantize());
  for (const e of decoded.getRoot().listExtensionsUsed())
    if (
      ["EXT_meshopt_compression", "KHR_mesh_quantization"].includes(
        e.extensionName,
      )
    )
      e.dispose();
  await doorIO.write(preview, decoded);
  return { textureSize: size, bytes: bytes.length, blackSurfacePixels: black };
}
