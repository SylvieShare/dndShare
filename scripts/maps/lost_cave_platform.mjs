import { caveRockPixel, darkenCaveFloorJoints } from "./lost_cave_surface.mjs";
import { surfaceNoise } from "./surface_noise.mjs";
const clamp = (v) => Math.max(0, Math.min(1, v));
const smooth = (a, b, v) => {
  const t = clamp((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
export function platformPartAt(p, n, spec) {
  const m = spec.platform;
  if (
    Math.hypot(p[0] - m.centre[0], p[1] - m.centre[1]) > m.radiusMM ||
    p[2] < m.minHeightMM
  )
    return "rock";
  return p[2] > m.topMinHeightMM && n[2] > 0.6
    ? "platform-top"
    : "platform-side";
}
export function paintCavePlatform(p, n, ao, spec) {
  const part = platformPartAt(p, n, spec);
  if (part === "rock")
    return darkenCaveFloorJoints(caveRockPixel(p, n, ao, spec), p, spec);
  const m = spec.platform;
  const topMix =
    smooth(m.topMinHeightMM - 0.4, m.topMinHeightMM + 0.7, p[2]) *
    smooth(0.3, 0.95, n[2]);
  const radius = Math.hypot(p[0] - m.centre[0], p[1] - m.centre[1]);
  const bodyMix =
    smooth(m.minHeightMM, m.minHeightMM + 1.2, p[2]) *
    (1 - smooth(m.radiusMM - 0.7, m.radiusMM, radius));
  const palette = {
    ...spec.palette,
    rock: m.sideTint.map((v, i) => {
      const detail = v * (1 - topMix) + m.topTint[i] * topMix;
      return spec.palette.rock[i] * (1 - bodyMix) + detail * bodyMix;
    }),
  };
  const value = caveRockPixel(p, n, ao, { ...spec, palette });
  const mineral = surfaceNoise(p[0] * 0.36, p[1] * 0.36, p[2] * 0.18);
  const strata =
    1 +
    (1 - topMix) *
      bodyMix *
      (-0.04 +
        0.06 *
          Math.sin(
            p[2] * 1.1 + surfaceNoise(p[0] * 0.08, p[1] * 0.08, 0) * 1.3,
          ));
  value.rgb = value.rgb.map((v, i) =>
    Math.round(
      255 *
        clamp((v / 255) * strata + (mineral - 0.5) * [0.012, 0.009, 0.006][i]),
    ),
  );
  value.part = part;
  value.roughness = 0.87 + 0.04 * topMix;
  return value;
}
