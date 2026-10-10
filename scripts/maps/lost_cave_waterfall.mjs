import { caveRockPixel, darkenCaveFloorJoints } from "./lost_cave_surface.mjs";
import { paintBoulder } from "./lost_cave_boulder.mjs";
import { surfaceNoise } from "./surface_noise.mjs";

const clamp = (v) => Math.max(0, Math.min(1, v));
const smooth = (a, b, v) => {
  const t = clamp((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};

export function waterfallPartAt(p, spec, projection) {
  if (!projection) throw new Error("Verified waterfall source masks required");
  const mask = projection(p);
  const part = mask?.part;
  const volumes = mask?.volumes ?? spec.waterfall.volumes?.[part];
  if (
    part &&
    (!volumes ||
      volumes.some((v) => p.every((x, i) => x >= v.min[i] && x <= v.max[i])))
  )
    return part;
  return "rock";
}

export function paintWaterfall(p, n, ao, spec, projection) {
  const part = waterfallPartAt(p, spec, projection);
  if (part === "boulder") return paintBoulder(p, n, ao, spec);
  if (part === "rock")
    return darkenCaveFloorJoints(caveRockPixel(p, n, ao, spec), p, spec);
  const w = spec.waterfall;
  const cross = p.reduce((sum, x, i) => sum + x * w.crossAxis[i], 0);
  const broad = surfaceNoise(cross * 0.35, p[2] * 0.035, 1.7);
  const streak = smooth(
    0.48,
    0.83,
    surfaceNoise(cross * 0.7, p[2] * 0.015, 3.1),
  );
  const foam =
    part === "foam"
      ? 0.5 + Math.max(0, n[2]) * 0.3 + broad * 0.12
      : part === "pool"
        ? smooth(w.foamNearXMM[1], w.foamNearXMM[0], p[0]) * 0.28
        : streak * 0.16;
  const clean = 0.9 + 0.1 * clamp((ao / 255 - 0.5) / 0.5);
  return {
    part,
    rgb: w.colour.map((v, i) =>
      Math.round(
        255 *
          clamp(
            (v * (0.96 + broad * 0.08) * (1 - foam) + w.foamColour[i] * foam) *
              clean,
          ),
      ),
    ),
    roughness: part === "foam" ? 0.34 + broad * 0.07 : 0.17 + broad * 0.04,
    metallic: 0,
  };
}
