// Compare a lighter albedo without changing accepted mesh, normal or ORM bytes.
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { readGlb, embeddedImage, replaceImages } from "./glb_textures.mjs";
import { rasterizeSurface } from "./uv_surface.mjs";
const reportFile = process.argv[2];
if (!reportFile) throw new Error("One reviewed report path required");
const directory = path.dirname(path.resolve(reportFile));
const roughnessStep = Number(
  process.argv.find((a) => a.startsWith("--roughness-step="))?.slice(17) || 1,
);
if (![1, 4].includes(roughnessStep))
  throw new Error("Reviewed roughness steps are 1 or 4");
const report = JSON.parse(await fs.readFile(reportFile, "utf8"));
if (!report.weightBudget)
  throw new Error("Record the model's weight estimate first");
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
const name =
  roughnessStep === 1 ? "albedo-1536-768" : "albedo-1536-768-roughness4";
const original = path.join(directory, "candidates/original"),
  candidate = path.join(directory, "candidates", name);
await fs.mkdir(original, { recursive: true });
await fs.mkdir(candidate, { recursive: true });
for (const name of [
  "render.glb",
  "lod.glb",
  "preview-model.glb",
  "lod-preview-model.glb",
  "preview.png",
  "top.png",
  "reverse.png",
])
  await fs.copyFile(path.join(directory, name), path.join(original, name));
await fs.writeFile(
  path.join(original, "report.json"),
  JSON.stringify(report, null, 2) + "\n",
);
const lighter = structuredClone(report);
lighter.optimization = {
  candidate: name,
  geometry: "unchanged",
  normal: "byte-exact",
  orm:
    roughnessStep === 1
      ? "byte-exact"
      : "AO and metallic byte-exact; roughness step 4/255",
  selection: "pending visual comparison",
  baseline: structuredClone(report.tiers),
};
for (const [tier, size] of [
  ["render", 1536],
  ["lod", 768],
]) {
  const before = await fs.readFile(path.join(directory, tier + ".glb")),
    glb = readGlb(before);
  const colours = new Set(
    glb.json.materials.flatMap((m) => {
      const t = m.pbrMetallicRoughness?.baseColorTexture?.index;
      return t === undefined ? [] : [glb.json.textures[t].source];
    }),
  );
  const replacements = new Map();
  for (const index of colours)
    replacements.set(
      index,
      await sharp(embeddedImage(glb, index))
        .resize(size, size)
        .png({ compressionLevel: 9 })
        .toBuffer(),
    );
  if (roughnessStep > 1) {
    const ormImages = new Set(
      glb.json.materials.flatMap((m) => {
        const t = m.pbrMetallicRoughness?.metallicRoughnessTexture?.index;
        return t === undefined ? [] : [glb.json.textures[t].source];
      }),
    );
    for (const index of ormImages) {
      const { data, info } = await sharp(embeddedImage(glb, index))
        .raw()
        .toBuffer({ resolveWithObject: true });
      for (let i = 1; i < data.length; i += info.channels)
        data[i] = Math.min(
          255,
          Math.round(data[i] / roughnessStep) * roughnessStep,
        );
      replacements.set(
        index,
        await sharp(data, { raw: info })
          .png({ compressionLevel: 9 })
          .toBuffer(),
      );
    }
  }
  const bytes = replaceImages(glb, replacements),
    file = path.join(candidate, tier + ".glb");
  await fs.writeFile(file, bytes);
  const doc = await io.read(file);
  await doc.transform(dequantize());
  const textured = doc
    .getRoot()
    .listMaterials()
    .filter((m) => m.getBaseColorTexture());
  const bases = new Set(textured.map((m) => m.getBaseColorTexture()));
  if (bases.size !== 1)
    throw new Error("This surface check expects one baked albedo atlas");
  const texture = [...bases][0],
    decoded = await sharp(Buffer.from(texture.getImage()))
      .raw()
      .toBuffer({ resolveWithObject: true });
  let black = 0;
  const coverage = rasterizeSurface(
    doc,
    decoded.info.width,
    decoded.info.height,
    (i) => {
      const p = i * decoded.info.channels;
      if (Math.max(...decoded.data.subarray(p, p + 3)) < 4) black++;
    },
  );
  if (black) throw new Error("Black used UV pixels after resize");
  for (const extension of doc.getRoot().listExtensionsUsed())
    if (extension.extensionName === "EXT_meshopt_compression")
      extension.dispose();
  await io.write(
    path.join(
      candidate,
      tier === "render" ? "preview-model.glb" : "lod-preview-model.glb",
    ),
    doc,
  );
  lighter.tiers[tier] = {
    ...report.tiers[tier],
    bakedSurfacePixels: report.tiers[tier].surfacePixels,
    textureSize: size,
    usedUvPixels: coverage.reduce((a, b) => a + b, 0),
    blackSurfacePixels: black,
    bytes: bytes.length,
  };
  delete lighter.tiers[tier].surfacePixels;
  console.log("ALBEDO_CANDIDATE", tier, before.length, bytes.length, size);
}
await fs.writeFile(
  path.join(candidate, "report.json"),
  JSON.stringify(lighter, null, 2) + "\n",
);
console.log("REVIEW_CANDIDATES", path.join(directory, "candidates"));
