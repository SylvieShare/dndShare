import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { readGlb, replaceImages } from "./glb_textures.mjs";
import {
  setSurfaceAtlas,
  initializeUntexturedSurfaceAtlas,
} from "./pbr_revision.mjs";
import { localModelAsset } from "./local_model_assets.mjs";
import {
  rasterizeSurface,
  seedSurfaceGutters,
  extendUvGutters,
} from "./uv_surface.mjs";
import { caveRockPixel, darkenCaveFloorJoints } from "./lost_cave_surface.mjs";
import { paintCaveTreasure } from "./lost_cave_treasure.mjs";
import { paintScaffoldingRamp } from "./lost_cave_scaffolding_ramp.mjs";
import { paintScaffolding } from "./lost_cave_scaffolding.mjs";
import { paintCutStone } from "./lost_cave_cut_stone.mjs";
import { paintStalagmites } from "./lost_cave_stalagmites.mjs";
import { paintRailway } from "./lost_cave_railway.mjs";
import { paintCrystal } from "./lost_cave_crystal.mjs";
import { paintWagon } from "./lost_cave_wagon.mjs";
import { paintWagonOnTrack } from "./lost_cave_wagon_track.mjs";
import { paintBoulderGround } from "./lost_cave_boulder_ground.mjs";
import { loadReviewedCaveViews } from "./reviewed_cave_views.mjs";
import { paintMushrooms } from "./lost_cave_mushrooms.mjs";
import { paintCaveBones } from "./lost_cave_bones.mjs";
import { paintCrystalGround } from "./lost_cave_crystal_ground.mjs";
import { wallReferenceDistance } from "./lost_cave_wall_reference.mjs";
import { createHash } from "node:crypto";
import { uvSurfaceTracker } from "./uv_surface_overlap.mjs";
import specs from "./lost_cave_recipes.mjs";
const file = process.argv[2];
if (!file) throw new Error("One rebaked Lost Cave report required");
const directory = path.dirname(path.resolve(file)),
  report = JSON.parse(await fs.readFile(file, "utf8"));
if (report.model.collection !== "lost-cave" || !report.rebake)
  throw new Error("Complete source normal/AO rebake first");
const spec = specs[report.model.sourceCode];
if (
  ![
    "cave-rock",
    "cave-cut-stone",
    "cave-scaffolding",
    "cave-scaffolding-ramp",
    "cave-treasure",
    "cave-stalagmites",
    "cave-railway",
    "cave-crystal",
    "cave-wagon",
    "cave-wagon-track",
    "cave-boulders",
    "cave-crystal-ground",
    "cave-bones",
    "cave-mushrooms",
  ].includes(spec.material)
)
  throw new Error("Unsupported individually reviewed surface material");
for (const field of [
  "sourceName",
  "renderTriangles",
  "lodTriangles",
  "renderBakeSize",
  "lodBakeSize",
  "uvAngleLimitRad",
  "flatFacets",
])
  if (spec[field] !== report.materialSpec[field])
    throw new Error("Geometry recipe changed; rebake before painting");
report.materialSpec = structuredClone(spec);
let wagonReference;
let crystalWallReference;
const bareReference =
  spec.crystal?.wallReference ??
  spec.bones?.reference ??
  spec.mushrooms?.wallReference ??
  spec.treasure?.wallReference;
if (bareReference) {
  const base = path.resolve(
    import.meta.dirname,
    "../../models/collections/lost-cave/wall-reference",
    bareReference.code,
  );
  const field = {
    spec: JSON.parse(
      await fs.readFile(path.join(base, "reference.json"), "utf8"),
    ),
    data: await fs.readFile(path.join(base, "distance.bin")),
  };
  if (
    field.spec.sourceCode !== bareReference.code ||
    field.spec.sourceSHA256 !== bareReference.sourceSHA256 ||
    createHash("sha256").update(field.data).digest("hex") !==
      field.spec.fieldSHA256
  )
    throw new Error("Verified original undecorated wall reference required");
  crystalWallReference = { distanceAt: (p) => wallReferenceDistance(p, field) };
}
const reviewedViews = (masks) => loadReviewedCaveViews(report, masks);

if (spec.bones?.projectedViews) {
  const match = await reviewedViews(spec.bones.projectedViews);
  crystalWallReference = {
    ...crystalWallReference,
    projectedBoneAt: (p) => Boolean(match(p)),
  };
}
let treasureProjection;
if (spec.treasure?.projectedViews) {
  const masks = spec.treasure.projectedViews.flatMap((view) =>
    view.regions.map((region) => ({
      ...region,
      name: view.name,
      toleranceMM: view.toleranceMM,
    })),
  );
  masks.sort((a, b) => Number(b.part === "gold") - Number(a.part === "gold"));
  const match = await reviewedViews(masks);
  const visible = await reviewedViews(
    spec.treasure.projectedViews.map((view) => ({
      ...view,
      polygons: [
        [
          [0, 0],
          [1024, 0],
          [1024, 1024],
          [0, 1024],
        ],
      ],
    })),
  );
  treasureProjection = match;
  treasureProjection.isVisible = (p) => Boolean(visible(p));
}
let mushroomProjection;
if (spec.mushrooms?.projectedViews) {
  const match = await reviewedViews(spec.mushrooms.projectedViews);
  mushroomProjection = (p) => match(p)?.part;
}
if (spec.material === "cave-wagon-track") {
  const base = path.resolve(
    import.meta.dirname,
    "../../models/collections/lost-cave/wagon-reference",
  );
  wagonReference = {
    spec: JSON.parse(
      await fs.readFile(path.join(base, "reference.json"), "utf8"),
    ),
    data: await fs.readFile(path.join(base, "distance.bin")),
  };
  if (wagonReference.spec.sourceSHA256 !== spec.wagonReferenceSHA256)
    throw new Error("Reviewed original wagon reference required");
}
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
    glb = readGlb(await fs.readFile(original));
  const atlasInitialized = initializeUntexturedSurfaceAtlas(
    glb,
    await fs.readFile(path.join(directory, tier + "-ao.png")),
  );
  const doc = atlasInitialized
    ? await io.readBinary(replaceImages(glb, new Map()))
    : await io.read(original);
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
  const counts = {
    rock: 0,
    ...(spec.material === "cave-treasure" ? { gold: 0, gem: 0 } : {}),
    ...(["cave-scaffolding", "cave-scaffolding-ramp"].includes(spec.material)
      ? { wood: 0, iron: 0 }
      : {}),
    ...(spec.material === "cave-cut-stone" ? { "cut-stone": 0 } : {}),
    ...(spec.material === "cave-mushrooms"
      ? {
          cap: 0,
          wart: 0,
          stalk: 0,
          gills: 0,
          bud: 0,
          shelf: 0,
          "shelf-green": 0,
          bowl: 0,
          honeycomb: 0,
          blue: 0,
          disc: 0,
          "disc-centre": 0,
        }
      : {}),
    ...(spec.material === "cave-bones" ? { bone: 0 } : {}),
    ...(spec.material === "cave-stalagmites" ? { calcite: 0 } : {}),
    ...(spec.material === "cave-railway" ? { wood: 0, iron: 0 } : {}),
    ...(spec.material === "cave-crystal" ? { crystal: 0 } : {}),
    ...(["cave-wagon", "cave-wagon-track"].includes(spec.material)
      ? { bucket: 0, wheel: 0, hardware: 0, brass: 0 }
      : {}),
    ...(spec.material === "cave-wagon-track" ? { wood: 0, iron: 0 } : {}),
    ...(spec.cargo ? { [spec.cargo.material]: 0 } : {}),
    ...(spec.material === "cave-boulders" ? { boulder: 0 } : {}),
    ...(spec.material === "cave-crystal-ground"
      ? { crystal: 0, crust: 0 }
      : {}),
  };
  const neutralNormal = new Uint8Array(size * size);
  const checkUv = spec.validateUvOverlaps
    ? uvSurfaceTracker(size, size)
    : undefined;
  const paintPixel = (i, p, n, used = true) => {
    if (used) checkUv?.(i, p);
    const value =
      spec.material === "cave-treasure"
        ? paintCaveTreasure(
            p,
            n,
            ao[i],
            spec,
            crystalWallReference,
            treasureProjection,
          )
        : spec.material === "cave-scaffolding-ramp"
          ? paintScaffoldingRamp(p, n, ao[i], spec)
          : spec.material === "cave-scaffolding"
            ? paintScaffolding(p, n, ao[i], spec)
            : spec.material === "cave-cut-stone"
              ? paintCutStone(p, n, ao[i], spec)
              : spec.material === "cave-mushrooms"
                ? paintMushrooms(
                    p,
                    n,
                    ao[i],
                    spec,
                    mushroomProjection,
                    crystalWallReference,
                  )
                : spec.material === "cave-bones"
                  ? paintCaveBones(p, n, ao[i], spec, crystalWallReference)
                  : spec.material === "cave-crystal-ground"
                    ? paintCrystalGround(
                        p,
                        n,
                        ao[i],
                        spec,
                        crystalWallReference,
                      )
                    : spec.material === "cave-boulders"
                      ? paintBoulderGround(p, n, ao[i], spec)
                      : spec.material === "cave-wagon-track"
                        ? paintWagonOnTrack(p, n, ao[i], spec, wagonReference)
                        : spec.material === "cave-wagon"
                          ? paintWagon(p, n, ao[i], spec)
                          : spec.material === "cave-crystal"
                            ? paintCrystal(p, n, ao[i], spec)
                            : spec.material === "cave-railway"
                              ? paintRailway(p, n, ao[i], spec)
                              : spec.material === "cave-stalagmites"
                                ? paintStalagmites(p, n, ao[i], spec)
                                : caveRockPixel(
                                    p,
                                    n,
                                    ao[i],
                                    report.materialSpec,
                                  );
    if (spec.floorHeightProfileMM && value.part === "rock")
      darkenCaveFloorJoints(value, p, spec);
    if (used) counts[value.part]++;
    neutralNormal[i] = Number(
      value.normalNeutral ||
        (spec.crystal?.normalMode === "geometry" && value.part === "crystal") ||
        (spec.cutStone?.normalMode === "geometry" &&
          value.part === "cut-stone"),
    );
    colour.set(value.rgb, i * 3);
    orm[i * 3] = ao[i];
    orm[i * 3 + 1] = Math.round(value.roughness * 255);
    orm[i * 3 + 2] = Math.round(value.metallic * 255);
    if (used) pixels++;
  };
  const coverage = rasterizeSurface(doc, size, size, paintPixel);
  if (!pixels) throw new Error("Rebuilt body has no rasterized UV surface");
  const colourCoverage = spec.surfaceGutters
    ? seedSurfaceGutters(doc, size, size, coverage, (i, p, n) =>
        paintPixel(i, p, n, false),
      )
    : coverage;
  const normal = await sharp(path.join(directory, tier + "-normal.png"))
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let black = 0,
    invalid = 0;
  for (let i = 0; i < coverage.length; i++)
    if (coverage[i]) {
      if (spec.normalMode === "geometry" || neutralNormal[i])
        normal.data.set([128, 128, 255], i * 3);
      if (Math.max(...colour.subarray(i * 3, i * 3 + 3)) < 4) black++;
      if (normal.data[i * 3 + 2] < 128) invalid++;
    }
  if (black || invalid)
    throw new Error(
      `Used UV defects: ${black} black, ${invalid} invalid normals`,
    );
  extendUvGutters(colour, 3, colourCoverage.slice(), size, size, 12);
  extendUvGutters(orm, 3, colourCoverage.slice(), size, size, 12);
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
    surfacePixels: counts,
    blackSurfacePixels: black,
    invalidNormalPixels: invalid,
    ...(checkUv ? { uvOverlaps: 0 } : {}),
  };
  console.log("LOST_CAVE_PAINTED", tier, report.tiers[tier]);
}
await fs.writeFile(file, JSON.stringify(report, null, 2) + "\n");
