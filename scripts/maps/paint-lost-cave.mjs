import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { readGlb, replaceImages } from "./glb_textures.mjs";
import { setSurfaceAtlas } from "./pbr_revision.mjs";
import { localModelAsset } from "./local_model_assets.mjs";
import { rasterizeSurface, extendUvGutters } from "./uv_surface.mjs";
import { caveRockPixel } from "./lost_cave_surface.mjs";
import specs from "./lost-cave-recipes.json" with { type: "json" };
const file = process.argv[2];
if (!file) throw new Error("One rebaked Lost Cave report required");
const directory = path.dirname(path.resolve(file)),
  report = JSON.parse(await fs.readFile(file, "utf8"));
if (report.model.collection !== "lost-cave" || !report.rebake)
  throw new Error("Complete source normal/AO rebake first");
const spec = specs[report.model.sourceCode];
if (spec.material !== "cave-rock")
  throw new Error("Unsupported individually reviewed surface material");
for (const field of [
  "sourceName",
  "renderTriangles",
  "lodTriangles",
  "renderBakeSize",
  "lodBakeSize",
])
  if (spec[field] !== report.materialSpec[field])
    throw new Error("Geometry recipe changed; rebake before painting");
report.materialSpec = structuredClone(spec);
const require = createRequire("/private/tmp/dndshare-model-tools/package.json"),
  sharp = require("sharp"),
  { NodeIO } = require("@gltf-transform/core"),
  { ALL_EXTENSIONS } = require("@gltf-transform/extensions"),
  { dequantize, meshopt } = require("@gltf-transform/functions"),
  { MeshoptDecoder, MeshoptEncoder } = require("meshoptimizer");
await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready]);
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    "meshopt.decoder": MeshoptDecoder,
    "meshopt.encoder": MeshoptEncoder,
  });
for (const tier of ["render", "lod"]) {
  const original = path.join(directory, tier + "-repacked.glb"),
    glb = readGlb(await fs.readFile(original)),
    doc = await io.read(original);
  await doc.transform(dequantize());
  const size = report.rebake[tier].bakeSize;
  const ao = await sharp(path.join(directory, tier + "-ao.png"))
    .resize(size, size)
    .extractChannel(0)
    .raw()
    .toBuffer();
  const colour = Buffer.alloc(size * size * 3, 96),
    orm = Buffer.alloc(size * size * 3);
  let pixels = 0;
  const coverage = rasterizeSurface(doc, size, size, (i, p, n) => {
    const value = caveRockPixel(p, n, ao[i], report.materialSpec);
    colour.set(value.rgb, i * 3);
    orm[i * 3] = ao[i];
    orm[i * 3 + 1] = Math.round(value.roughness * 255);
    orm[i * 3 + 2] = Math.round(value.metallic * 255);
    pixels++;
  });
  const normal = await sharp(path.join(directory, tier + "-normal.png"))
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let black = 0,
    invalid = 0;
  for (let i = 0; i < coverage.length; i++)
    if (coverage[i]) {
      if (Math.max(...colour.subarray(i * 3, i * 3 + 3)) < 4) black++;
      if (normal.data[i * 3 + 2] < 128) invalid++;
    }
  if (black || invalid)
    throw new Error(
      `Used UV defects: ${black} black, ${invalid} invalid normals`,
    );
  extendUvGutters(colour, 3, coverage.slice(), size, size, 12);
  extendUvGutters(orm, 3, coverage.slice(), size, size, 12);
  extendUvGutters(normal.data, 3, coverage.slice(), size, size, 12);
  const raw = { width: size, height: size, channels: 3 };
  const replacements = new Map();
  for (const [slot, data] of [
    ["BaseColor", colour],
    ["MetallicRoughness", orm],
    ["Normal", normal.data],
  ]) {
    const png = await sharp(data, { raw })
      .png({ compressionLevel: 9 })
      .toBuffer();
    replacements.set(setSurfaceAtlas(glb, slot, png), png);
  }
  const compressed = await io.readBinary(replaceImages(glb, replacements));
  await compressed.transform(
    meshopt({
      encoder: MeshoptEncoder,
      level: "high",
      quantizePosition: 16,
      quantizeTexcoord: 16,
    }),
  );
  const bytes = await io.writeBinary(compressed);
  await fs.writeFile(path.join(directory, tier + ".glb"), bytes);
  const preview = await io.readBinary(bytes);
  await preview.transform(dequantize());
  for (const ext of preview.getRoot().listExtensionsUsed())
    if (ext.extensionName === "EXT_meshopt_compression") ext.dispose();
  await io.write(
    path.join(
      directory,
      tier === "render" ? "preview-model.glb" : "lod-preview-model.glb",
    ),
    preview,
  );
  report.tiers[tier] = {
    textureSize: size,
    bytes: bytes.length,
    surfacePixels: { rock: pixels },
    blackSurfacePixels: black,
    invalidNormalPixels: invalid,
  };
  console.log("LOST_CAVE_PAINTED", tier, report.tiers[tier]);
}
await fs.writeFile(file, JSON.stringify(report, null, 2) + "\n");
