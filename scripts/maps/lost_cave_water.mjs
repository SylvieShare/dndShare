import { caveRockPixel, darkenCaveFloorJoints } from "./lost_cave_surface.mjs";
import { surfaceNoise } from "./surface_noise.mjs";
import { paintCavePlatform } from "./lost_cave_platform.mjs";
import { paintBoulder } from "./lost_cave_boulder.mjs";
const clamp = (v) => Math.max(0, Math.min(1, v));
export function caveWaterAt(p, n, spec) {
  if (spec.water.tileVolume) {
    const v = spec.water.tileVolume;
    return p.every((x, i) => x >= v.min[i] && x <= v.max[i]) ? v : undefined;
  }
  return spec.water.surfaces.find(
    (s) =>
      Math.abs(p[2] - s.heightMM) < s.toleranceMM &&
      n[2] > 0.35 &&
      Math.hypot(p[0] - s.centre[0], p[1] - s.centre[1]) < s.radiusMM,
  );
}
export function paintCaveWater(p, n, ao, spec, projection, reference) {
  if (spec.water.projectedViews && !projection)
    throw new Error("Verified dry shoreline source masks required");
  if (spec.water.bareReference && !reference)
    throw new Error("Verified undecorated water reference required");
  if (
    spec.water.dryFaces?.some(
      (face) =>
        p.every((x, i) => x >= face.min[i] && x <= face.max[i]) &&
        n.reduce((sum, x, i) => sum + x * face.normal[i], 0) >
          face.normalDotMin,
    )
  )
    return caveRockPixel(p, n, ao, spec);
  const wave = spec.water.waveGuards?.some(
    (g) =>
      (g.maxHeightMM === undefined || p[2] <= g.maxHeightMM) &&
      Math.hypot(...p.map((x, i) => x - g.centre[i])) < g.radiusMM &&
      n.reduce((sum, x, i) => sum + x * g.normal[i], 0) > g.normalDotMin,
  );
  if (
    !wave &&
    (spec.water.boulderFaces?.some(
      (face) =>
        p.every((x, i) => x >= face.min[i] && x <= face.max[i]) &&
        n.reduce((sum, x, i) => sum + x * face.normal[i], 0) >
          face.normalDotMin,
    ) ||
      spec.water.boulderGuards?.some(
        (g) =>
          Math.hypot(...p.map((x, i) => x - g.centre[i])) < g.radiusMM &&
          n.reduce((sum, x, i) => sum + x * g.normal[i], 0) > g.normalDotMin,
      ))
  )
    return paintBoulder(p, n, ao, spec);
  let projected = wave ? undefined : projection?.(p);
  if (projected?.minHeightMM !== undefined && p[2] < projected.minHeightMM)
    projected = undefined;
  if (
    projected?.volumes &&
    !projected.volumes.some((v) =>
      p.every((x, i) => x >= v.min[i] && x <= v.max[i]),
    )
  )
    projected = undefined;
  if (projected?.part === "boulder") return paintBoulder(p, n, ao, spec);
  const addedRock =
    spec.water.bareReference &&
    reference.distanceAt(p) > spec.water.bareReference.matchMM;
  if (
    (projected?.part === "platform" || addedRock) &&
    (!spec.water.bareReference || addedRock)
  )
    return paintCavePlatform(p, n, ao, spec);
  const water = caveWaterAt(p, n, spec);
  if (!water)
    return darkenCaveFloorJoints(caveRockPixel(p, n, ao, spec), p, spec);
  if (spec.water.tileVolume) {
    const noise = surfaceNoise(p[0] * 0.1, p[1] * 0.1, p[2] * 0.04);
    const clean = 0.91 + 0.09 * clamp((ao / 255 - 0.5) / 0.5);
    const depthTint = spec.water.depthTint
      ? 1 -
        spec.water.depthTint.amount *
          clamp(
            (spec.water.depthTint.startMM - p[2]) /
              (spec.water.depthTint.startMM - spec.water.depthTint.endMM),
          )
      : 1;
    return {
      part: "water",
      rgb: spec.water.colour.map((v) =>
        Math.round(255 * clamp(v * clean * depthTint * (0.96 + noise * 0.08))),
      ),
      roughness: (spec.water.roughness ?? 0.18) + noise * 0.025,
      metallic: 0,
    };
  }
  const noise = surfaceNoise(p[0] * 0.22, p[1] * 0.22, 0.7);
  const radius = Math.hypot(p[0] - water.centre[0], p[1] - water.centre[1]);
  const border = clamp(
    (radius - water.radiusMM * 0.72) / (water.radiusMM * 0.28),
  );
  const clean = 0.87 + 0.13 * clamp((ao / 255 - 0.65) / 0.35);
  const variation = (0.97 + 0.06 * noise) * (1 - border * 0.045);
  return {
    part: "water",
    rgb: spec.water.colour.map((v) =>
      Math.round(255 * clamp(v * clean * variation)),
    ),
    roughness: 0.12 + noise * 0.04,
    metallic: 0,
    normalNeutral: true,
  };
}
