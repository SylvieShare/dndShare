// Correct the actual timber surfaces on both registered LODs; preserve mesh bytes.
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { readGlb, embeddedImage, replaceImages } from "./glb_textures.mjs";
import { rasterizeSurface, extendUvGutters } from "./uv_surface.mjs";
import { paintTimberPixel, TIMBER_RECIPE } from "./ud006_material.mjs";
const root = path.resolve(import.meta.dirname, "../.."),
  base = path.join(root, "models/collections");
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
const models = JSON.parse(
  await fs.readFile(path.join(base, "registry.json"), "utf8"),
);
const model = models
  .filter(
    (m) => m.collection === "ultimate-dungeon" && m.sourceCode === "UD-006",
  )
  .sort((a, b) => b.version - a.version)[0];
if (!model) throw new Error("UD-006 not registered");
const directory = path.join(base, "ud006-painted", "UD-006__" + model.version);
await fs.mkdir(directory, { recursive: true });
const report = { model, recipe: TIMBER_RECIPE, tiers: {} };
async function original(asset) {
  for (const folder of [
    "stone-dungeon/upload",
    "simple-pegs/upload",
    "painted/upload",
    "upload",
  ]) {
    const p = path.join(base, folder, path.basename(asset.key));
    if (await fs.stat(p).catch(() => null)) return p;
  }
  throw new Error("Missing local " + asset.fileName);
}
for (const tier of ["render", "lod"]) {
  const source = await original(model.assets[tier]),
    glb = readGlb(await fs.readFile(source)),
    doc = await io.read(source);
  await doc.transform(dequantize());
  const material = glb.json.materials.find(
    (m) => m.pbrMetallicRoughness?.baseColorTexture,
  );
  const colorIndex =
    glb.json.textures[material.pbrMetallicRoughness.baseColorTexture.index]
      .source;
  const ormIndex =
    glb.json.textures[
      material.pbrMetallicRoughness.metallicRoughnessTexture.index
    ].source;
  const size = tier === "render" ? 2048 : 1024;
  const color = await sharp(embeddedImage(glb, colorIndex))
    .resize(size, size)
    .raw()
    .toBuffer({ resolveWithObject: true });
  const before = Buffer.from(color.data),
    counts = { post: 0, brace: 0, foot: 0, stone: 0 },
    channels = color.info.channels;
  const coverage = rasterizeSurface(
    doc,
    size,
    size,
    (index, position, normal) => {
      const pixel = index * channels,
        rgb = [before[pixel], before[pixel + 1], before[pixel + 2]],
        paint = paintTimberPixel(rgb, position, normal);
      for (let c = 0; c < 3; c++) color.data[pixel + c] = paint.rgb[c];
      counts[paint.part]++;
    },
  );
  if (!counts.post || !counts.brace || !counts.foot)
    throw new Error("A timber component was missed");
  let black = 0;
  for (let i = 0; i < coverage.length; i++)
    if (
      coverage[i] &&
      Math.max(
        color.data[i * channels],
        color.data[i * channels + 1],
        color.data[i * channels + 2],
      ) < 4
    )
      black++;
  if (black) throw new Error("Black surface pixels: " + black);
  extendUvGutters(
    color.data,
    channels,
    coverage,
    size,
    size,
    tier === "render" ? 12 : 6,
  );
  const orm = await sharp(embeddedImage(glb, ormIndex))
    .raw()
    .toBuffer({ resolveWithObject: true });
  const ormCoverage = rasterizeSurface(
    doc,
    orm.info.width,
    orm.info.height,
    (index, position, normal) => {
      const paint = paintTimberPixel([80, 85, 89], position, normal);
      // Stone roughness is restored where the old height mask coloured bricks wood.
      const roughness = paint.part === "stone" ? 0.9 : paint.roughness;
      orm.data[index * orm.info.channels + 1] = Math.round(roughness * 255);
    },
    "MetallicRoughness",
  );
  // Only roughness gutters are extended: the original AO/metallic remain exact.
  const rough = Buffer.from(
    Array.from(
      { length: orm.info.width * orm.info.height },
      (_, i) => orm.data[i * orm.info.channels + 1],
    ),
  );
  extendUvGutters(rough, 1, ormCoverage, orm.info.width, orm.info.height, 6);
  for (let i = 0; i < rough.length; i++)
    orm.data[i * orm.info.channels + 1] = rough[i];
  const replacements = new Map([
    [colorIndex, await sharp(color.data, { raw: color.info }).png().toBuffer()],
    [ormIndex, await sharp(orm.data, { raw: orm.info }).png().toBuffer()],
  ]);
  const output = path.join(directory, tier + ".glb"),
    bytes = replaceImages(glb, replacements);
  await fs.writeFile(output + ".next", bytes);
  await fs.rename(output + ".next", output);
  report.tiers[tier] = {
    textureSize: size,
    surfacePixels: counts,
    blackSurfacePixels: black,
    bytes: bytes.length,
  };
  if (tier === "render") {
    const preview = await io.read(output);
    await preview.transform(dequantize());
    for (const ext of preview.getRoot().listExtensionsUsed())
      if (ext.extensionName === "EXT_meshopt_compression") ext.dispose();
    await io.write(path.join(directory, "preview-model.glb"), preview);
  }
  console.log("PAINTED_UD006", tier, report.tiers[tier]);
}
await fs.writeFile(
  path.join(directory, "report.json"),
  JSON.stringify(report, null, 2) + "\n",
);
