import { caveRockPixel, darkenCaveFloorJoints } from "./lost_cave_surface.mjs";
import { surfaceNoise } from "./surface_noise.mjs";
const clamp = (v) => Math.max(0, Math.min(1, v));
export function caveWaterAt(p, n, spec) {
  return spec.water.surfaces.find(
    (s) =>
      Math.abs(p[2] - s.heightMM) < s.toleranceMM &&
      n[2] > 0.35 &&
      Math.hypot(p[0] - s.centre[0], p[1] - s.centre[1]) < s.radiusMM,
  );
}
export function paintCaveWater(p, n, ao, spec) {
  const water = caveWaterAt(p, n, spec);
  if (!water)
    return darkenCaveFloorJoints(caveRockPixel(p, n, ao, spec), p, spec);
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
