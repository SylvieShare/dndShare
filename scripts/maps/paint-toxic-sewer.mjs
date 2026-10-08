import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { uvSurfaceTracker } from "./uv_surface_overlap.mjs";
import {
  readGlb,
  replaceImages,
  appendEmbeddedImage,
} from "./glb_textures.mjs";
import { setSurfaceAtlas } from "./pbr_revision.mjs";
import { localModelAsset } from "./local_model_assets.mjs";
import {
  rasterizeSurface,
  seedSurfaceGutters,
  extendUvGutters,
} from "./uv_surface.mjs";
import { sewerMasonryPixel } from "./toxic_sewer_surface.mjs";
import specs from "./toxic_sewer_recipes.mjs";
const file = process.argv[2];
if (!file) throw new Error("One rebaked Toxic Sewer report required");
const directory = path.dirname(path.resolve(file)),
  report = JSON.parse(await fs.readFile(file, "utf8"));
if (report.model.collection !== "toxic-sewer" || !report.rebake)
  throw new Error("Complete source normal/AO rebake first");
const spec = specs[report.model.sourceCode];
const reference = spec.referenceCode
  ? JSON.parse(
      await fs.readFile(
        path.resolve(
          import.meta.dirname,
          "../../models/collections/toxic-sewer/references",
          spec.referenceCode + ".json",
        ),
        "utf8",
      ),
    )
  : null;
if (spec.proximityReference) {
  if (!reference) throw Error("Bare surface reference required for proximity");
  const base = path.resolve(
    import.meta.dirname,
    "../../models/collections/toxic-sewer/references",
  );
  const grid = JSON.parse(
    await fs.readFile(
      path.join(base, spec.proximityReference.code + "-proximity.json"),
      "utf8",
    ),
  );
  const bytes = await fs.readFile(path.join(base, grid.binary));
  const archive = JSON.parse(
    await fs.readFile(path.join(base, "../../manifest.json"), "utf8"),
  );
  const bare = archive.find(
    (row) =>
      row.collection === "toxic-sewer" &&
      row.code === spec.proximityReference.code,
  );
  if (
    !bare ||
    (spec.proximityReference.minimumSurfaceZMM !== undefined &&
      !grid.cutCapsExcluded) ||
    grid.sourceSHA256 !== bare.sourceSHA256 ||
    grid.code !== spec.proximityReference.code ||
    grid.stepMM !== spec.proximityReference.stepMM ||
    (grid.rotationZDegrees ?? 0) !==
      (spec.proximityReference.rotationZDegrees ?? 0) ||
    (grid.minimumSurfaceZMM ?? null) !==
      (spec.proximityReference.minimumSurfaceZMM ?? null) ||
    JSON.stringify(grid.boundsMM) !==
      JSON.stringify(spec.proximityReference.boundsMM) ||
    createHash("sha256").update(bytes).digest("hex") !== grid.valuesSHA256
  )
    throw Error("Proximity field source or bytes differ");
  const values = new Float32Array(bytes.length / 4);
  for (let i = 0; i < values.length; i++) values[i] = bytes.readFloatLE(i * 4);
  reference.proximity = {
    ...grid,
    thresholdMM: spec.proximityReference.thresholdMM,
    values,
  };
}
if (!["sewer-masonry", "sewer-components"].includes(spec.material))
  throw new Error("Unsupported individually reviewed surface material");
for (const field of [
  "sourceName",
  "renderTriangles",
  "lodTriangles",
  "renderBakeSize",
  "lodBakeSize",
  "mounting",
  "renderMountTriangles",
  "lodMountTriangles",
  "openingProbesMM",
  "mountInnerColor",
  "mountInnerRoughness",
  "mountRegions",
  "uvAngleLimitRad",
  "uvIslandMargin",
])
  if (
    JSON.stringify(spec[field]) !== JSON.stringify(report.materialSpec[field])
  )
    throw new Error("Geometry recipe changed; rebake before painting");
report.materialSpec = structuredClone(spec);
if (reference)
  report.referenceSurface = {
    code: reference.code,
    sourceSHA256: reference.sourceSHA256,
    stepMM: reference.floor.step,
    minimumWallYMM: reference.minimumWallYMM ?? 8,
    maximumFloorZMM: reference.maximumFloorZMM ?? 15,
    ...(reference.proximity
      ? {
          proximity: {
            code: reference.proximity.code,
            sourceSHA256: reference.proximity.sourceSHA256,
            rotationZDegrees: reference.proximity.rotationZDegrees ?? 0,
            minimumSurfaceZMM: reference.proximity.minimumSurfaceZMM ?? null,
            cutCapsExcluded: reference.proximity.cutCapsExcluded ?? false,
            boundsMM: reference.proximity.boundsMM,
            stepMM: reference.proximity.stepMM,
            thresholdMM: reference.proximity.thresholdMM,
            valuesSHA256: reference.proximity.valuesSHA256,
          },
        }
      : {}),
  };
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
    orm = Buffer.alloc(size * size * 3),
    emission = Buffer.alloc(size * size * 3);
  let hasEmission = false;
  let pixels = 0;
  const counts = Object.fromEntries(
    ["stone", ...new Set((spec.regions ?? []).map((r) => r.part))].map(
      (part) => [part, 0],
    ),
  );
  const trackSurface = uvSurfaceTracker(size, size);
  const paintPixel = (i, p, n, used = true) => {
    if (used) trackSurface(i, p);
    const value = sewerMasonryPixel(
      p,
      n,
      ao[i],
      report.materialSpec,
      reference,
      report.sourceShiftMM,
    );
    if (used) counts[value.part]++;
    colour.set(value.rgb, i * 3);
    orm[i * 3] = ao[i];
    orm[i * 3 + 1] = Math.round(value.roughness * 255);
    orm[i * 3 + 2] = Math.round(value.metallic * 255);
    emission.set(value.emission ?? [0, 0, 0], i * 3);
    if (value.emission) hasEmission = true;
    if (used) pixels++;
  };
  const coverage = rasterizeSurface(doc, size, size, paintPixel);
  const colourCoverage = seedSurfaceGutters(
    doc,
    size,
    size,
    coverage,
    (i, p, n) => paintPixel(i, p, n, false),
  );
  const normal = await sharp(path.join(directory, tier + "-normal.png"))
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let black = 0,
    invalid = 0;
  if (!pixels)
    throw Error("UV atlas has no covered surface pixels; rebuild packing");
  for (let i = 0; i < coverage.length; i++)
    if (coverage[i]) {
      if (Math.max(...colour.subarray(i * 3, i * 3 + 3)) < 4) black++;
      if (normal.data[i * 3 + 2] < 128) invalid++;
    }
  if (black || invalid)
    throw new Error(
      `Used UV defects: ${black} black, ${invalid} invalid normals`,
    );
  extendUvGutters(colour, 3, colourCoverage.slice(), size, size, 12);
  extendUvGutters(orm, 3, colourCoverage.slice(), size, size, 12);
  if (hasEmission)
    extendUvGutters(emission, 3, colourCoverage.slice(), size, size, 12);
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
  if (hasEmission) {
    const png = await sharp(emission, { raw })
      .png({ compressionLevel: 9 })
      .toBuffer();
    const imageIndex = appendEmbeddedImage(glb, png);
    const mat = glb.json.materials.find(
      (m) => m.pbrMetallicRoughness?.baseColorTexture,
    );
    const baseInfo = mat.pbrMetallicRoughness.baseColorTexture;
    const baseTexture = glb.json.textures[baseInfo.index];
    const textureIndex = glb.json.textures.length;
    glb.json.textures.push({
      source: imageIndex,
      ...(baseTexture.sampler !== undefined
        ? { sampler: baseTexture.sampler }
        : {}),
    });
    mat.emissiveTexture = { ...structuredClone(baseInfo), index: textureIndex };
    mat.emissiveFactor = [1, 1, 1];
    replacements.set(imageIndex, png);
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
    surfacePixels: counts,
    blackSurfacePixels: black,
    invalidNormalPixels: invalid,
  };
  console.log("TOXIC_SEWER_PAINTED", tier, report.tiers[tier]);
}
await fs.writeFile(file, JSON.stringify(report, null, 2) + "\n");
