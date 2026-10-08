// Recolour registered GLBs directly; retain mesh bytes, normal/ORM maps and metadata.
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { readGlb, embeddedImage, replaceImages } from "./glb_textures.mjs";
import { columnMask, repairColumnBones } from "./column_materials.mjs";
import {
  MASONRY_REVISION,
  PEG,
  srgbToLinear,
  recolorMasonry,
} from "./masonry_palette.mjs";
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
const registry = JSON.parse(
  await fs.readFile(path.join(base, "registry.json"), "utf8"),
);
const latest = new Map();
for (const m of registry) {
  if (m.collection !== "ultimate-dungeon") continue;
  const key = `${m.sourceCode}:${m.sourceName}`;
  if (!latest.has(key)) latest.set(key, m);
}
const codes = process.argv
  .find((a) => a.startsWith("--codes="))
  ?.slice(8)
  .split(",");
async function assetPath(asset) {
  for (const folder of ["simple-pegs/upload", "painted/upload", "upload"]) {
    const file = path.join(base, folder, path.basename(asset.key));
    if (await fs.stat(file).catch(() => null)) return file;
  }
  throw new Error(`Missing local ${asset.fileName}: ${asset.sha256}`);
}
for (const model of [...latest.values()].sort((a, b) =>
  `${a.sourceCode}:${a.sourceName}`.localeCompare(
    `${b.sourceCode}:${b.sourceName}`,
  ),
)) {
  if (codes && !codes.includes(model.sourceCode)) continue;
  const slug = `${model.sourceCode}__${model.sourceName.replaceAll(/[^a-zA-Z0-9_-]/g, "_")}__${model.assets.render.sha256.slice(0, 12)}`;
  const directory = path.join(base, "stone-dungeon", slug);
  await fs.mkdir(directory, { recursive: true });
  const existing = await fs
    .readFile(path.join(directory, "report.json"), "utf8")
    .catch(() => null);
  if (
    existing &&
    JSON.parse(existing).recipe === MASONRY_REVISION &&
    !process.argv.includes("--force")
  )
    continue;
  await fs.rm(path.join(directory, "preview.png"), { force: true });
  const report = { model, recipe: MASONRY_REVISION, tiers: {} };
  for (const tier of ["render", "lod"]) {
    const originalPath = await assetPath(model.assets[tier]);
    const glb = readGlb(await fs.readFile(originalPath));
    const column = ["UD-087", "UD-088", "UD-089"].includes(model.sourceCode)
      ? await io.read(originalPath)
      : null;
    if (column) await column.transform(dequantize());
    const images = new Set(
      glb.json.materials.flatMap((m) => {
        const index = m.pbrMetallicRoughness?.baseColorTexture?.index;
        return index === undefined ? [] : [glb.json.textures[index].source];
      }),
    );
    const replacements = new Map(),
      evidence = [];
    for (const index of images) {
      const { data, info } = await sharp(embeddedImage(glb, index))
        .raw()
        .toBuffer({ resolveWithObject: true });
      const changed = recolorMasonry(data, info.channels);
      const repairedColumnPixels = column
        ? repairColumnBones(
            changed.data,
            info.channels,
            columnMask(column, model.sourceCode, info.width, info.height),
          )
        : 0;
      const png = await sharp(changed.data, { raw: info }).png().toBuffer();
      replacements.set(index, png);
      evidence.push({
        affected: changed.affected,
        full: changed.full,
        pixels: changed.pixels,
        repairedColumnPixels,
      });
    }
    if (!evidence.some((e) => e.affected > 0))
      throw new Error(`No masonry found: ${model.sourceCode}`);
    for (const material of glb.json.materials)
      if (material.name === "Simple insertion pegs")
        material.pbrMetallicRoughness.baseColorFactor = [
          ...PEG.map(srgbToLinear),
          1,
        ];
    const bytes = replaceImages(glb, replacements);
    const output = path.join(directory, `${tier}.glb`);
    await fs.writeFile(output + ".next", bytes);
    await fs.rename(output + ".next", output);
    report.tiers[tier] = { bytes: bytes.length, images: evidence };
    if (tier === "render") {
      const doc = await io.read(output);
      await doc.transform(dequantize());
      for (const ext of doc.getRoot().listExtensionsUsed())
        if (ext.extensionName === "EXT_meshopt_compression") ext.dispose();
      await io.write(path.join(directory, "preview-model.glb"), doc);
    }
  }
  await fs.writeFile(
    path.join(directory, "report.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(
    "REPAINTED",
    model.sourceCode,
    model.sourceName,
    report.tiers.render.images,
  );
}
