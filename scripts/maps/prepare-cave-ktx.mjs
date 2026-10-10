import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readGlb, embeddedImage, replaceImages } from "./glb_textures.mjs";
import { rasterizeSurface, extendUvGutters } from "./uv_surface.mjs";
import { caveTexturePlan, caveTextureSize } from "./cave_texture_plan.mjs";
const run = promisify(execFile),
  file = process.argv[2],
  name = process.argv[3];
const variants = {
  "ktx-balanced": [1536, 1024, 768, 512],
  "ktx-compact": [1024, 1024, 512, 512],
};
if (!file || !variants[name])
  throw new Error("One Lost Cave report and known texture candidate required");
const directory = path.dirname(path.resolve(file)),
  out = path.join(directory, "candidates", name),
  report = JSON.parse(await fs.readFile(file, "utf8")),
  tools = process.env.KTX_TOOLS || "/private/tmp/dndshare-ktx-tools/bin";
if (report.model.collection !== "lost-cave" || !report.weightBudget)
  throw new Error("One measured Lost Cave report required");
if (
  report.materialSpec.preserveSurfaceGutters &&
  !report.materialSpec.surfaceGutters
)
  throw new Error(
    "Physical surface gutters must be prepared before preserving them",
  );
const normalMinZ = report.materialSpec.normalMinZ ?? 0.01;
if (!["etc1s", "uastc"].includes(report.materialSpec.albedoCodec ?? "etc1s"))
  throw new Error("Unsupported reviewed albedo codec");
const sizes = caveTexturePlan(report.materialSpec, name);
if (!Number.isFinite(normalMinZ) || normalMinZ < 0.01 || normalMinZ > 0.2)
  throw new Error("Reviewed normal minimum Z must be between0.01 and0.2");
await fs.mkdir(out, { recursive: true });
const baseline = path.join(directory, "candidates/png");
await fs.mkdir(baseline, { recursive: true });
for (const entry of [
  "render.glb",
  "lod.glb",
  "preview-model.glb",
  "lod-preview-model.glb",
  "preview.png",
  "top.png",
  "reverse.png",
])
  await fs.copyFile(path.join(directory, entry), path.join(baseline, entry));
await fs.writeFile(
  path.join(baseline, "report.json"),
  JSON.stringify(report, null, 2) + "\n",
);
const require = createRequire("/private/tmp/dndshare-model-tools/package.json"),
  sharp = require("sharp"),
  { NodeIO } = require("@gltf-transform/core"),
  { ALL_EXTENSIONS } = require("@gltf-transform/extensions"),
  { dequantize } = require("@gltf-transform/functions"),
  { MeshoptDecoder } = require("meshoptimizer");
await MeshoptDecoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ "meshopt.decoder": MeshoptDecoder });
const candidate = structuredClone(report);
candidate.optimization = {
  candidate: name,
  geometry: "accepted bytes unchanged",
  selection: "pending visual comparison",
  baseline: structuredClone(report.tiers),
  maps: [],
};
const version = await run(path.join(tools, "toktx"), ["--version"]);
candidate.optimization.encoder = (version.stdout || version.stderr).trim();
if (
  !candidate.optimization.encoder ||
  (report.materialSpec.textureEncoder &&
    candidate.optimization.encoder !== report.materialSpec.textureEncoder)
)
  throw new Error("Texture encoder differs from the reviewed recipe");
for (const [ti, tier] of ["render", "lod"].entries()) {
  const bytes = await fs.readFile(path.join(directory, tier + ".glb")),
    g = readGlb(bytes),
    doc = await io.readBinary(bytes);
  await doc.transform(dequantize());
  const mat = g.json.materials.find(
      (m) => m.pbrMetallicRoughness?.baseColorTexture,
    ),
    slots = [
      ["BaseColor", mat.pbrMetallicRoughness.baseColorTexture.index],
      ["Normal", mat.normalTexture.index],
      [
        "MetallicRoughness",
        mat.pbrMetallicRoughness.metallicRoughnessTexture.index,
      ],
      ...(mat.emissiveTexture ? [["Emissive", mat.emissiveTexture.index]] : []),
    ];
  const encoded = new Map(),
    decoded = new Map();
  let black = 0,
    invalid = 0;
  for (const [slot, index] of slots) {
    const image = g.json.textures[index].source,
      size = caveTextureSize(report.materialSpec, sizes, tier, slot),
      result = await sharp(embeddedImage(g, image))
        .resize(size, size)
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true }),
      data = result.data;
    if (slot === "Normal")
      for (let i = 0; i < data.length; i += 3) {
        const n = [
            data[i] / 127.5 - 1,
            data[i + 1] / 127.5 - 1,
            Math.max(normalMinZ, data[i + 2] / 127.5 - 1),
          ],
          length = Math.hypot(...n);
        for (let c = 0; c < 3; c++)
          data[i + c] = Math.round((n[c] / length + 1) * 127.5);
      }
    const coverage = rasterizeSurface(doc, size, size, () => {}, slot);
    // The painter has already seeded tiny islands from physical surfaces.
    // A new coverage raster can miss them and overwrite their gutter colours.
    if (!report.materialSpec.preserveSurfaceGutters)
      extendUvGutters(data, 3, coverage.slice(), size, size, 8);
    const prefix = path.join(out, tier + "-" + slot),
      input = prefix + ".png",
      output = prefix + ".ktx2",
      preview = prefix + "-decoded.png";
    await sharp(data, { raw: { width: size, height: size, channels: 3 } })
      .png()
      .toFile(input);
    const flags = [
      "--t2",
      "--genmipmap",
      "--upper_left_maps_to_s0t0",
      "--assign_oetf",
      ["BaseColor", "Emissive"].includes(slot) ? "srgb" : "linear",
      "--assign_primaries",
      "bt709",
      "--target_type",
      "RGB",
      "--threads",
      "6",
    ];
    if (slot === "BaseColor" && report.materialSpec.albedoCodec !== "uastc")
      flags.push("--encode", "etc1s", "--qlevel", "255", "--clevel", "3");
    else
      flags.push(
        "--encode",
        "uastc",
        "--uastc_quality",
        "3",
        "--uastc_rdo_l",
        slot === "Normal"
          ? "0.35"
          : ["BaseColor", "Emissive"].includes(slot)
            ? "0.1"
            : "1",
        "--zcmp",
        "18",
      );
    await run(path.join(tools, "toktx"), [...flags, output, input], {
      maxBuffer: 1048576,
    });
    await run(path.join(tools, "ktx"), ["validate", output], {
      maxBuffer: 1048576,
    });
    await run(
      path.join(tools, "ktx"),
      ["extract", "--transcode", "rgba8", "--level", "0", output, preview],
      { maxBuffer: 1048576 },
    );
    const actual = await sharp(preview).removeAlpha().raw().toBuffer();
    for (let i = 0; i < coverage.length; i++)
      if (coverage[i]) {
        if (
          slot === "BaseColor" &&
          Math.max(...actual.subarray(i * 3, i * 3 + 3)) < 4
        )
          black++;
        if (slot === "Normal" && actual[i * 3 + 2] < 125) invalid++;
      }
    const payload = await fs.readFile(output);
    encoded.set(image, payload);
    decoded.set(image, await fs.readFile(preview));
    candidate.optimization.maps.push({
      tier,
      slot,
      size,
      format: "image/ktx2",
      bytes: payload.length,
    });
    console.log("CAVE_KTX", name, tier, slot, size, payload.length);
  }
  if (black || invalid)
    throw new Error(
      `Decoded surface defects: ${black} black, ${invalid} invalid normals`,
    );
  for (const [, index] of slots) {
    const texture = g.json.textures[index],
      source = texture.source;
    delete texture.source;
    texture.extensions = {
      ...texture.extensions,
      KHR_texture_basisu: { source },
    };
    g.json.images[source].mimeType = "image/ktx2";
  }
  for (const field of ["extensionsUsed", "extensionsRequired"])
    g.json[field] = [
      ...new Set([...(g.json[field] || []), "KHR_texture_basisu"]),
    ];
  const final = replaceImages(g, encoded);
  await fs.writeFile(path.join(out, tier + ".glb"), final);
  const png = readGlb(final);
  for (const [, index] of slots) {
    const texture = png.json.textures[index],
      source = texture.extensions.KHR_texture_basisu.source;
    delete texture.extensions.KHR_texture_basisu;
    if (!Object.keys(texture.extensions).length) delete texture.extensions;
    texture.source = source;
    png.json.images[source].mimeType = "image/png";
  }
  for (const field of ["extensionsUsed", "extensionsRequired"])
    png.json[field] = png.json[field].filter((v) => v !== "KHR_texture_basisu");
  const preview = await io.readBinary(replaceImages(png, decoded));
  await preview.transform(dequantize());
  for (const ext of preview.getRoot().listExtensionsUsed())
    if (ext.extensionName === "EXT_meshopt_compression") ext.dispose();
  await io.write(
    path.join(
      out,
      tier === "render" ? "preview-model.glb" : "lod-preview-model.glb",
    ),
    preview,
  );
  candidate.tiers[tier] = {
    ...candidate.tiers[tier],
    textureSize: sizes[ti * 2],
    bytes: final.length,
    blackSurfacePixels: black,
    invalidNormalPixels: invalid,
  };
}
await fs.writeFile(
  path.join(out, "report.json"),
  JSON.stringify(candidate, null, 2) + "\n",
);
