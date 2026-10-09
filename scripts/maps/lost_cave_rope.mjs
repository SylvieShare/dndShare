import { caveRockPixel, darkenCaveFloorJoints } from "./lost_cave_surface.mjs";
import { surfaceNoise } from "./surface_noise.mjs";
const clamp = (v) => Math.max(0, Math.min(1, v));
export function ropeAxisAt(p, paths) {
  let best;
  for (const path of paths) {
    let distanceAlong = 0;
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1],
        b = path[i];
      const d = b.map((v, k) => v - a[k]),
        length = Math.hypot(...d);
      if (!length) continue;
      const t = clamp(
        p.reduce((v, x, k) => v + (x - a[k]) * d[k], 0) / length ** 2,
      );
      const offset = p.map((v, k) => v - a[k] - t * d[k]);
      const radius = Math.hypot(...offset);
      if (!best || radius < best.radius)
        best = {
          radius,
          along: distanceAlong + t * length,
          offset,
          direction: d.map((v) => v / length),
        };
      distanceAlong += length;
    }
  }
  if (!best) throw new Error("Measured rope paths required");
  return best;
}
export function paintCaveRope(p, n, ao, spec, projection) {
  if (!projection)
    throw new Error("Reviewed source-depth rope contours required");
  if (p[2] <= spec.floorHeightMM + spec.rope.floorClearanceMM || !projection(p))
    return darkenCaveFloorJoints(caveRockPixel(p, n, ao, spec), p, spec);
  const axis = ropeAxisAt(p, spec.rope.paths);
  const coarse = surfaceNoise(...p.map((v) => v * 1.3));
  const d = axis.direction;
  const seed = Math.abs(d[2]) < 0.9 ? [0, 0, 1] : [0, 1, 0];
  const side = [
    d[1] * seed[2] - d[2] * seed[1],
    d[2] * seed[0] - d[0] * seed[2],
    d[0] * seed[1] - d[1] * seed[0],
  ];
  const length = Math.hypot(...side);
  const across = axis.offset.reduce((v, x, i) => v + (x * side[i]) / length, 0);
  const fibre = Math.sin(across * 20 + axis.along * 0.35);
  const clean = 0.73 + 0.27 * clamp((ao / 255 - 0.65) / 0.35);
  const variation = (0.92 + coarse * 0.12 + fibre * 0.025) * clean;
  return {
    part: "rope",
    rgb: spec.rope.colour.map((v) => Math.round(255 * clamp(v * variation))),
    roughness: spec.rope.roughness,
    metallic: 0,
  };
}
