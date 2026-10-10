import { paintBoulder } from "./lost_cave_boulder.mjs";
import { caveRockPixel, darkenCaveFloorJoints } from "./lost_cave_surface.mjs";
export function boulderGroundPartAt(p, n, spec) {
  if (
    spec.boulder.volumes?.some(
      (v) =>
        p.reduce(
          (sum, value, i) => sum + ((value - v.center[i]) / v.radius[i]) ** 2,
          0,
        ) < 1,
    )
  )
    return "boulder";
  if (spec.boulder.onlyVolumes) return "rock";
  if (p[2] > spec.boulder.topThresholdMM) return "boulder";
  if (
    p[2] > spec.boulder.rootMinZMM &&
    n[2] < 0.9 &&
    spec.boulder.roots.some(
      (r) => ((p[0] - r.x) / r.rx) ** 2 + ((p[1] - r.y) / r.ry) ** 2 < 1,
    )
  )
    return "boulder";
  return "rock";
}
export function paintBoulderGround(p, n, ao, spec) {
  if (boulderGroundPartAt(p, n, spec) === "boulder") {
    const stone = paintBoulder(p, n, ao, spec);
    if (spec.boulder.rootBlendMM) {
      const floor = darkenCaveFloorJoints(
          caveRockPixel(p, n, ao, spec),
          p,
          spec,
        ),
        t = Math.max(
          0,
          Math.min(
            1,
            (p[2] - spec.boulder.rootMinZMM) / spec.boulder.rootBlendMM,
          ),
        ),
        weight = t * t * (3 - 2 * t);
      stone.rgb = stone.rgb.map((v, i) =>
        Math.round(v * weight + floor.rgb[i] * (1 - weight)),
      );
    }
    return stone;
  }
  return darkenCaveFloorJoints(caveRockPixel(p, n, ao, spec), p, spec);
}
