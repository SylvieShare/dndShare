// Re-baked 60k/20k geometry and portable GPU textures for one reviewed tile.
import fs from "node:fs/promises";
import path from "node:path";
import { majesticModel } from "./majestic_model.mjs";
import { isDeepStrictEqual } from "node:util";
import { createRequire } from "node:module";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const run = promisify(execFile),
  root = path.resolve(import.meta.dirname, "../.."),
  base = path.join(root, "models/collections/majestic-highlands");
const require = createRequire("/private/tmp/dndshare-model-tools/package.json");
const sharp = require("sharp"),
  { NodeIO } = require("@gltf-transform/core"),
  { ALL_EXTENSIONS, KHRTextureBasisu } = require("@gltf-transform/extensions"),
  { meshopt, dequantize } = require("@gltf-transform/functions"),
  { MeshoptEncoder, MeshoptDecoder } = require("meshoptimizer");
await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready]);
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    "meshopt.encoder": MeshoptEncoder,
    "meshopt.decoder": MeshoptDecoder,
  });
const code =
  process.argv.find((a) => a.startsWith("--code="))?.slice(7) ?? "MH-001";
const nativeRoot = path.join(base, "optimized-native", code);
const measured = JSON.parse(
  await fs.readFile(path.join(nativeRoot, "render/report.json"), "utf8"),
);
const tools = process.env.KTX_TOOLS ?? "/private/tmp/dndshare-ktx-tools/bin",
  out = path.join(base, "optimized-review", code);
const registry = JSON.parse(
  await fs.readFile(path.join(base, "registry-snapshot.json"), "utf8"),
);
const previous = registry
  .filter(
    (m) =>
      m.collection === "majestic-highlands" &&
      m.sourceCode === code &&
      m.sourceName === measured.sourceName &&
      m.assets.source.sha256 === measured.sourceSHA256,
  )
  .sort((a, b) => b.version - a.version)[0];
const metadata = previous ?? majesticModel(measured);
await fs.mkdir(out, { recursive: true });
const report = {
  model: metadata,
  recipe: "majestic-ktx2-v1",
  materialRecipe: measured.recipe.recipe,
  sourcePath: measured.sourcePath,
  sourceSHA256: measured.sourceSHA256,
  sourceNote: measured.sourceNote,
  sizeAssessment: measured.recipe.sizeAssessment,
  tiers: {},
};
if (previous) report.previousModelID = previous.id;
for (const tier of ["render", "lod"]) {
  const native = path.join(nativeRoot, tier),
    info = JSON.parse(
      await fs.readFile(path.join(native, "report.json"), "utf8"),
    );
  if (info.sourceSHA256 !== measured.sourceSHA256)
    throw new Error("Source changed");
  if (!isDeepStrictEqual(info.recipe, measured.recipe))
    throw new Error(
      "Render and LOD must be baked with the same material recipe",
    );
  const drift = Math.max(
    ...info.placementPoints.map((p, i) =>
      Math.abs(p.elevation - metadata.placementPoints[i].elevation),
    ),
  );
  if (drift > 0.03) throw new Error("Support surface drift exceeds 1.05 mm");
  const doc = await io.read(path.join(native, "model.glb")),
    decodedImages = [];
  const colours = new Set(
    doc
      .getRoot()
      .listMaterials()
      .map((m) => m.getBaseColorTexture()),
  );
  const normals = new Set(
    doc
      .getRoot()
      .listMaterials()
      .map((m) => m.getNormalTexture()),
  );
  for (const mat of doc.getRoot().listMaterials()) mat.setMetallicFactor(0);
  const textures = doc.getRoot().listTextures();
  for (let index = 0; index < textures.length; index++) {
    const texture = textures[index],
      colour = colours.has(texture),
      normal = normals.has(texture);
    const size = colour
      ? (measured.recipe[tier + "ColourSize"] ??
        (tier === "render" ? 2048 : 1024))
      : (measured.recipe[tier + "DataSize"] ??
        (tier === "render" ? 1024 : 512));
    const { data, info: imageInfo } = await sharp(
      Buffer.from(texture.getImage()),
    )
      .resize(size, size)
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    if (normal)
      for (let i = 0; i < data.length; i += imageInfo.channels) {
        const n = [
            data[i] / 127.5 - 1,
            data[i + 1] / 127.5 - 1,
            Math.max(0.05, data[i + 2] / 127.5 - 1),
          ],
          length = Math.hypot(...n);
        for (let j = 0; j < 3; j++)
          data[i + j] = Math.round((n[j] / length + 1) * 127.5);
      }
    const name = tier + "-" + index,
      input = path.join(out, name + ".png"),
      encoded = path.join(out, name + ".ktx2"),
      decoded = path.join(out, name + "-decoded.png");
    await sharp(data, { raw: imageInfo }).png().toFile(input);
    const flags = [
      "--t2",
      "--genmipmap",
      "--upper_left_maps_to_s0t0",
      "--assign_oetf",
      colour ? "srgb" : "linear",
      "--assign_primaries",
      "bt709",
      "--target_type",
      "RGB",
      "--threads",
      "6",
    ];
    if (colour)
      flags.push("--encode", "etc1s", "--qlevel", "255", "--clevel", "3");
    else
      flags.push(
        "--encode",
        "uastc",
        "--uastc_quality",
        "3",
        "--uastc_rdo_l",
        normal ? "0.35" : "1",
        "--zcmp",
        "18",
      );
    await run(path.join(tools, "toktx"), [...flags, encoded, input], {
      maxBuffer: 1048576,
    });
    await run(path.join(tools, "ktx"), ["validate", encoded], {
      maxBuffer: 1048576,
    });
    await run(
      path.join(tools, "ktx"),
      ["extract", "--transcode", "rgba8", "--level", "0", encoded, decoded],
      { maxBuffer: 1048576 },
    );
    texture.setImage(await fs.readFile(encoded)).setMimeType("image/ktx2");
    decodedImages.push(await fs.readFile(decoded));
    console.log(
      "KTX_ENCODED",
      tier,
      texture.getName(),
      (await fs.stat(encoded)).size,
    );
  }
  doc.createExtension(KHRTextureBasisu).setRequired(true);
  await doc.transform(meshopt({ encoder: MeshoptEncoder, level: "high" }));
  await io.write(path.join(out, tier + ".glb"), doc);
  const preview = await io.read(path.join(out, tier + ".glb"));
  await preview.transform(dequantize());
  for (const [i, texture] of preview.getRoot().listTextures().entries())
    texture.setImage(decodedImages[i]).setMimeType("image/png");
  for (const extension of preview.getRoot().listExtensionsUsed())
    if (
      ["KHR_texture_basisu", "EXT_meshopt_compression"].includes(
        extension.extensionName,
      )
    )
      extension.dispose();
  await io.write(
    path.join(
      out,
      tier === "render" ? "preview-model.glb" : "lod-preview-model.glb",
    ),
    preview,
  );
  report.tiers[tier] = {
    triangles: info.renderTriangles,
    bytes: (await fs.stat(path.join(out, tier + ".glb"))).size,
    placementDrift: drift,
    colourSize:
      measured.recipe[tier + "ColourSize"] ?? (tier === "render" ? 2048 : 1024),
    quality: info.quality,
  };
}
await fs.writeFile(
  path.join(out, "report.json"),
  JSON.stringify(report, null, 2) + "\n",
);
console.log("MAJESTIC_OPTIMIZED", report.tiers);
