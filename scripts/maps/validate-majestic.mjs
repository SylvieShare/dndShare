// Validate actual textured surfaces and physical dimensions of each reviewed tier.
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { rasterizeSurface } from "./uv_surface.mjs";
const root = path.resolve(import.meta.dirname, "../.."),
  base = path.join(root, "models/collections/majestic-highlands");
const code = process.argv.find((a) => a.startsWith("--code="))?.slice(7);
if (!code) throw new Error("Reviewed code required");
const directory = path.join(base, "review", code),
  report = JSON.parse(
    await fs.readFile(path.join(directory, "report.json"), "utf8"),
  );
const require = createRequire("/private/tmp/dndshare-model-tools/package.json");
const sharp = require("sharp"),
  { NodeIO } = require("@gltf-transform/core"),
  { ALL_EXTENSIONS } = require("@gltf-transform/extensions"),
  { dequantize } = require("@gltf-transform/functions"),
  { MeshoptDecoder } = require("meshoptimizer");
await MeshoptDecoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ "meshopt.decoder": MeshoptDecoder });
for (const tier of ["render", "lod"]) {
  const doc = await io.read(path.join(directory, tier + ".glb"));
  await doc.transform(dequantize());
  let pegTriangles = 0,
    triangles = 0;
  for (const node of doc.getRoot().listNodes())
    for (const primitive of node.getMesh()?.listPrimitives() ?? []) {
      const count = primitive.getIndices().getCount() / 3;
      triangles += count;
      if (node.getName().includes("insertion")) pegTriangles += count;
      for (const name of ["POSITION", "NORMAL"]) {
        const values = primitive.getAttribute(name).getArray();
        if (!values.every(Number.isFinite)) throw new Error("Invalid " + name);
      }
    }
  if (pegTriangles !== 12)
    throw new Error("Insertion taper must have twelve triangles");
  if (triangles !== report.tiers[tier].triangles)
    throw new Error("Triangle count mismatch");
  let pixelsChecked = 0;
  const mat = doc
    .getRoot()
    .listMaterials()
    .find((m) => m.getBaseColorTexture());
  for (const [slot, texture] of [
    ["BaseColor", mat.getBaseColorTexture()],
    ["Normal", mat.getNormalTexture()],
    ["MetallicRoughness", mat.getMetallicRoughnessTexture()],
  ]) {
    const { data, info } = await sharp(Buffer.from(texture.getImage()))
      .raw()
      .toBuffer({ resolveWithObject: true });
    rasterizeSurface(
      doc,
      info.width,
      info.height,
      (i) => {
        const offset = i * info.channels;
        if (
          slot === "BaseColor" &&
          Math.max(data[offset], data[offset + 1], data[offset + 2]) < 4
        )
          throw new Error("Black surface pixel");
        if (slot === "Normal" && data[offset + 2] < 128)
          throw new Error("Opposite normal hemisphere");
        if (slot === "MetallicRoughness" && data[offset + 2] !== 0)
          throw new Error("Grass must be nonmetallic");
        pixelsChecked++;
      },
      slot,
    );
  }
  if (
    report.model.width !== 3 ||
    report.model.height !== 3 ||
    report.model.placementPoints.length !== 9
  )
    throw new Error("Incorrect reviewed footprint");
  console.log("MAJESTIC_VALIDATED", code, tier, {
    triangles,
    pegTriangles,
    pixelsChecked,
  });
}
