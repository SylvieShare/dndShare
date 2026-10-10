// Validate actual textured surfaces and physical dimensions of each reviewed tier.
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { rasterizeSurface } from "./uv_surface.mjs";
import { uvSurfaceTracker } from "./uv_surface_overlap.mjs";
const root = path.resolve(import.meta.dirname, "../.."),
  base = path.join(root, "models/collections/majestic-highlands");
const code = process.argv.find((a) => a.startsWith("--code="))?.slice(7);
if (!code) throw new Error("Reviewed code required");
const optimized = process.argv.includes("--optimized");
const directory = path.join(
    base,
    optimized ? "optimized-review" : "review",
    code,
  ),
  report = JSON.parse(
    await fs.readFile(path.join(directory, "report.json"), "utf8"),
  );
const require = createRequire("/private/tmp/dndshare-model-tools/package.json");
const sharp = require("sharp"),
  { NodeIO } = require("@gltf-transform/core"),
  { ALL_EXTENSIONS } = require("@gltf-transform/extensions"),
  { dequantize } = require("@gltf-transform/functions"),
  { MeshoptDecoder } = require("meshoptimizer");
const recipeIndex = JSON.parse(
  await fs.readFile(
    path.join(root, "scripts/maps/majestic-recipes.json"),
    "utf8",
  ),
);
const recipe = JSON.parse(
  await fs.readFile(path.join(root, "scripts/maps", recipeIndex[code]), "utf8"),
);
function reviewedMetalRegion(position) {
  return (recipe.wheels ?? []).some((w) => {
    const length = Math.hypot(...w.normal),
      n = w.normal.map((v) => v / length),
      d = position.map((v, i) => v - w.centreMM[i]);
    const axial = d.reduce((s, v, i) => s + v * n[i], 0),
      radial = Math.hypot(...d.map((v, i) => v - axial * n[i]));
    return (
      Math.abs(axial) < w.halfThicknessMM + 1.5 &&
      radial < w.radiusMM + 2 &&
      (radial > w.radiusMM - w.ironBandMM - 1.5 ||
        (radial < (w.ironHubRadiusMM ?? 0) + 1.5 &&
          Math.abs(axial) > w.hubFaceMM - 1.5))
    );
  });
}
await MeshoptDecoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ "meshopt.decoder": MeshoptDecoder });
for (const tier of ["render", "lod"]) {
  const runtime = await io.read(path.join(directory, tier + ".glb"));
  if (optimized) {
    if (
      !runtime
        .getRoot()
        .listExtensionsRequired()
        .some((e) => e.extensionName === "KHR_texture_basisu")
    )
      throw new Error("KTX2 extension must be required");
    for (const texture of runtime.getRoot().listTextures()) {
      const bytes = Buffer.from(texture.getImage());
      if (
        texture.getMimeType() !== "image/ktx2" ||
        bytes.readUInt32LE(12) !== 0 ||
        bytes.readUInt32LE(40) < 10
      )
        throw new Error("Expected transcodable KTX2 with mipmaps");
    }
  }
  const doc = optimized
    ? await io.read(
        path.join(
          directory,
          tier === "render" ? "preview-model.glb" : "lod-preview-model.glb",
        ),
      )
    : runtime;
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
  if (pegTriangles !== (recipe.preserveNativeMount ? 0 : 12))
    throw new Error("Synthetic insertion count does not match the reviewed mounting mode");
  if (triangles !== report.tiers[tier].triangles)
    throw new Error("Triangle count mismatch");
  let pixelsChecked = 0,
    metalPixels = 0,
    emissivePixels = 0;
  const mat = doc
    .getRoot()
    .listMaterials()
    .find((m) => m.getBaseColorTexture());
  const waterAreas = (recipe.water?.validationAreas ?? []).map((area) => ({
    ...area,
    colour: { total: 0, correct: 0 },
    roughness: { total: 0, correct: 0 },
  }));
  for (const [slot, texture] of [
    ["BaseColor", mat.getBaseColorTexture()],
    ["Normal", mat.getNormalTexture()],
    ["MetallicRoughness", mat.getMetallicRoughnessTexture()],
    ["Emissive", mat.getEmissiveTexture()],
  ].filter(([, texture]) => texture)) {
    const { data, info } = await sharp(Buffer.from(texture.getImage()))
      .raw()
      .toBuffer({ resolveWithObject: true });
    const trackSurface = uvSurfaceTracker(info.width, info.height, 0.1);
    rasterizeSurface(
      doc,
      info.width,
      info.height,
      (i, position, physicalNormal) => {
        trackSurface(i, position);
        const offset = i * info.channels;
        if (slot === "BaseColor" || slot === "MetallicRoughness")
          for (const area of waterAreas) {
            if (position.some((v, k) => v < area.minMM[k] || v > area.maxMM[k]))
              continue;
            if (area.normalZMin != null && physicalNormal[2] < area.normalZMin)
              continue;
            const channel = slot === "BaseColor" ? area.colour : area.roughness;
            channel.total++;
            const isWater = area.material === "water";
            const correct =
              slot === "BaseColor"
                ? isWater
                  ? data[offset + 2] > data[offset] + 15
                  : data[offset] > data[offset + 2] + 15
                : isWater
                  ? data[offset + 1] < 140
                  : data[offset + 1] > 180;
            if (correct) channel.correct++;
          }
        if (
          slot === "BaseColor" &&
          Math.max(data[offset], data[offset + 1], data[offset + 2]) < 4
        )
          throw new Error("Black surface pixel");
        if (slot === "Normal" && data[offset + 2] < 128)
          throw new Error("Opposite normal hemisphere");
        if (
          slot === "MetallicRoughness" &&
          data[offset + 2] !== 0 &&
          (!optimized || mat.getMetallicFactor() !== 0) &&
          !recipe.metallicFactor
        )
          throw new Error("Grass must be nonmetallic");
        if (slot === "MetallicRoughness" && recipe.metallicFactor) {
          if (data[offset + 2] > 32 && !reviewedMetalRegion(position))
            throw new Error("Metal leaked outside reviewed wheel hardware");
          if (data[offset + 2] > 128) metalPixels++;
        }
        if (
          slot === "Emissive" &&
          Math.max(data[offset], data[offset + 1], data[offset + 2]) > 64
        ) {
          const bounds = recipe.camp?.flame;
          if (
            !bounds ||
            position.some(
              (v, j) => v < bounds.minMM[j] - 2 || v > bounds.maxMM[j] + 2,
            )
          )
            throw new Error("Emission leaked outside the reviewed flame");
          emissivePixels++;
        }
        pixelsChecked++;
      },
      slot,
    );
  }
  for (const area of waterAreas)
    for (const [name, channel] of [
      ["colour", area.colour],
      ["roughness", area.roughness],
    ])
      if (
        channel.total < (area.minPixels ?? 50) ||
        channel.correct / channel.total < (area.minimumFraction ?? .97)
      )
        throw new Error(
          `${tier} ${area.name} ${name}: ${channel.correct}/${channel.total} expected water/stone pixels`,
        );
  if (waterAreas.length) console.log("MAJESTIC_WATER_AREAS", code, tier, waterAreas);
  if (recipe.metallicFactor && metalPixels < 100)
    throw new Error("Reviewed iron parts lost their metallic channel");
  if (recipe.flameReference && emissivePixels < 100)
    throw new Error("Flame lost its emission texture");
  if (
    report.model.width !== recipe.width ||
    report.model.height !== recipe.height ||
    report.model.canStand !== (recipe.canStand ?? true) ||
    report.model.placementPoints.length !==
      (recipe.canStand === false ? 0 : recipe.width * recipe.height - (recipe.blockedCells?.length ?? 0))
  )
    throw new Error("Incorrect reviewed footprint");
  console.log("MAJESTIC_VALIDATED", code, tier, {
    triangles,
    pegTriangles,
    pixelsChecked,
  });
}
