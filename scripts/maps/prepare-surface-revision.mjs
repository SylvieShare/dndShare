// Correct the actual timber surfaces on both registered LODs; preserve mesh bytes.
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { readGlb, embeddedImage, replaceImages } from "./glb_textures.mjs";
import { rasterizeSurface, extendUvGutters } from "./uv_surface.mjs";
import { localModelAsset } from "./local_model_assets.mjs";
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
export async function prepareSurfaceRevision({
  code,
  sourceName,
  folder,
  recipe,
  paintPixel,
  parts,
  updateMetallic = false,
  colorReferenceVersion,
  textureDetail = "detailed",
  preserveORM = false,
  preserveTextureSize = false,
  sampleAO = false,
  allowEmptyParts = false,
  weightBudget,
}) {
  const models = JSON.parse(
    await fs.readFile(
      path.join(base, "ultimate-dungeon/registry-snapshot.json"),
      "utf8",
    ),
  );
  const model = models
    .filter(
      (m) =>
        m.collection === "ultimate-dungeon" &&
        m.sourceCode === code &&
        (sourceName === undefined || m.sourceName === sourceName),
    )
    .sort((a, b) => b.version - a.version)[0];
  if (!model) throw new Error(code + " not registered");
  const suffix =
    sourceName === undefined
      ? ""
      : "__" + sourceName.replace(/[^a-z0-9]+/gi, "_");
  const directory = path.join(
    base,
    folder,
    code + suffix + "__" + model.version,
  );
  await fs.mkdir(directory, { recursive: true });
  await fs.rm(path.join(directory, "preview.png"), { force: true });
  const report = {
    model: { ...model, textureDetail },
    recipe,
    tiers: {},
    ...(weightBudget ? { weightBudget } : {}),
  };
  const colorReference =
    colorReferenceVersion === undefined
      ? model
      : models.find(
          (m) =>
            m.collection === model.collection &&
            m.sourceCode === code &&
            m.sourceName === model.sourceName &&
            m.version === colorReferenceVersion,
        );
  if (
    !colorReference ||
    colorReference.assets.source.sha256 !== model.assets.source.sha256
  )
    throw new Error("Invalid colour reference");
  report.colorReferenceVersion = colorReference.version;
  async function original(asset) {
    return localModelAsset(asset);
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
    const colorGlb = readGlb(
      await fs.readFile(await original(colorReference.assets[tier])),
    );
    for (const key of ["accessors", "meshes", "nodes"])
      if (JSON.stringify(colorGlb.json[key]) !== JSON.stringify(glb.json[key]))
        throw new Error("Colour reference geometry/UV mismatch: " + key);
    const size = preserveTextureSize
      ? (await sharp(embeddedImage(colorGlb, colorIndex)).metadata()).width
      : tier === "render"
        ? 2048
        : 1024;
    const color = await sharp(embeddedImage(colorGlb, colorIndex))
      .resize(size, size)
      .raw()
      .toBuffer({ resolveWithObject: true });
    const before = Buffer.from(color.data),
      counts = Object.fromEntries(parts.map((part) => [part, 0])),
      channels = color.info.channels;
    let ao;
    if (sampleAO) {
      const { index: colorSlot, ...colorInfo } =
        material.pbrMetallicRoughness.baseColorTexture;
      const { index: ormSlot, ...ormInfo } =
        material.pbrMetallicRoughness.metallicRoughnessTexture;
      if (JSON.stringify(colorInfo) !== JSON.stringify(ormInfo))
        throw new Error("AO and colour UV transforms differ");
      ao = await sharp(embeddedImage(glb, ormIndex))
        .resize(size, size)
        .extractChannel(0)
        .raw()
        .toBuffer();
    }
    const coverage = rasterizeSurface(
      doc,
      size,
      size,
      (index, position, normal) => {
        const pixel = index * channels,
          rgb = [before[pixel], before[pixel + 1], before[pixel + 2]],
          paint = paintPixel(rgb, position, normal, ao?.[index]);
        for (let c = 0; c < 3; c++) color.data[pixel + c] = paint.rgb[c];
        counts[paint.part]++;
      },
    );
    if (!allowEmptyParts && parts.some((part) => !counts[part]))
      throw new Error("A surface material was missed");
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
    const ormColor = sampleAO
      ? await sharp(embeddedImage(colorGlb, colorIndex))
          .resize(orm.info.width, orm.info.height)
          .raw()
          .toBuffer({ resolveWithObject: true })
      : null;
    const ormCoverage = rasterizeSurface(
      doc,
      orm.info.width,
      orm.info.height,
      (index, position, normal) => {
        const offset = index * (ormColor?.info.channels ?? 0);
        const rgb = ormColor
          ? [
              ormColor.data[offset],
              ormColor.data[offset + 1],
              ormColor.data[offset + 2],
            ]
          : [80, 85, 89];
        const paint = paintPixel(
          rgb,
          position,
          normal,
          orm.data[index * orm.info.channels],
        );
        // Stone roughness is restored where the old height mask coloured bricks wood.
        const roughness = paint.roughness ?? 0.9;
        orm.data[index * orm.info.channels + 1] = Math.round(roughness * 255);
        if (updateMetallic)
          orm.data[index * orm.info.channels + 2] = Math.round(
            paint.metallic * 255,
          );
      },
      "MetallicRoughness",
    );
    // AO remains exact; models without metal also preserve the metallic channel.
    const packedChannels = updateMetallic ? 2 : 1,
      packed = Buffer.alloc(orm.info.width * orm.info.height * packedChannels);
    for (let i = 0; i < ormCoverage.length; i++)
      for (let c = 0; c < packedChannels; c++)
        packed[i * packedChannels + c] =
          orm.data[i * orm.info.channels + c + 1];
    extendUvGutters(
      packed,
      packedChannels,
      ormCoverage,
      orm.info.width,
      orm.info.height,
      6,
    );
    for (let i = 0; i < ormCoverage.length; i++)
      for (let c = 0; c < packedChannels; c++)
        orm.data[i * orm.info.channels + c + 1] =
          packed[i * packedChannels + c];
    const replacements = new Map([
      [
        colorIndex,
        await sharp(color.data, { raw: color.info }).png().toBuffer(),
      ],
      ...(preserveORM
        ? []
        : [
            [
              ormIndex,
              await sharp(orm.data, { raw: orm.info }).png().toBuffer(),
            ],
          ]),
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
    const preview = await io.read(output);
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
    console.log("PAINTED_SURFACES", code, tier, report.tiers[tier]);
  }
  await fs.writeFile(
    path.join(directory, "report.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
}
