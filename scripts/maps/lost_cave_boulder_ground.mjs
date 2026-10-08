import { paintBoulder } from "./lost_cave_boulder.mjs";
import { caveRockPixel } from "./lost_cave_surface.mjs";
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
  if (boulderGroundPartAt(p, n, spec) === "boulder")
    return paintBoulder(p, n, ao, spec);
  const value = caveRockPixel(p, n, ao, spec);
  const depth = spec.floorHeightMM - p[2];
  if (depth > 0.25 && depth < 3)
    value.rgb = value.rgb.map((v) =>
      Math.round(v * (1 - Math.min(1, depth / 1.5) * 0.22)),
    );
  return value;
}
