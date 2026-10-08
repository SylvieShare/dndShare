import { paintCrystal } from "./lost_cave_crystal.mjs";
import { caveRockPixel, darkenCaveFloorJoints } from "./lost_cave_surface.mjs";
import { surfaceNoise } from "./surface_noise.mjs";
const clamp = (v) => Math.max(0, Math.min(1, v));
export function crystalGroundPartAt(p, spec, wallReference) {
  if (
    wallReference &&
    wallReference.distanceAt(p) <= spec.crystal.wallReference.matchMM
  )
    return "rock";
  const c = spec.crystal;
  return p[2] > spec.floorHeightMM + 0.22 &&
    c.clusters.some((r) =>
      r.bounds
        ? p
            .slice(0, 2)
            .every((v, i) => v >= r.bounds.min[i] && v <= r.bounds.max[i])
        : ((p[0] - r.x) / r.rx) ** 2 + ((p[1] - r.y) / r.ry) ** 2 < 1,
    )
    ? "crystal"
    : "rock";
}
export function paintCrystalGround(p, n, ao, spec, wallReference) {
  if (crystalGroundPartAt(p, spec, wallReference) === "crystal")
    return paintCrystal(p, n, ao, spec);
  const value = caveRockPixel(p, n, ao, spec),
    c = spec.crystal;
  if (
    p[2] > spec.floorHeightMM - 1.2 &&
    p[2] < spec.floorHeightMM + 0.5 &&
    n[2] > 0.35
  ) {
    let amount = 0;
    for (const r of c.clusters) {
      const distance = Math.sqrt(
        ((p[0] - r.x) / (r.rx + c.crustWidthMM)) ** 2 +
          ((p[1] - r.y) / (r.ry + c.crustWidthMM)) ** 2,
      );
      amount = Math.max(
        amount,
        clamp((1 - distance) * 4) * (r.crustStrength ?? 0.8),
      );
    }
    if (amount > 0.01) {
      const grain = 0.9 + 0.15 * surfaceNoise(...p.map((v) => v * 0.8)),
        recess = 0.78 + 0.22 * clamp((ao / 255 - 0.65) / 0.35);
      value.rgb = value.rgb.map((v, i) =>
        Math.round(
          v * (1 - amount) + c.crustTint[i] * 255 * grain * recess * amount,
        ),
      );
      value.roughness = 0.94;
      value.part = "crust";
    }
  }
  return darkenCaveFloorJoints(value, p, spec);
}
