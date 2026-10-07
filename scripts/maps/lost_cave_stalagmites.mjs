import { caveRockPixel } from "./lost_cave_surface.mjs";
import { surfaceNoise } from "./surface_noise.mjs";
import { srgbToLinear } from "./masonry_palette.mjs";
const clamp = (v) => Math.max(0, Math.min(1, v));
const smooth = (a, b, v) => {
  const t = clamp((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const srgb = (v) =>
  v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055;
export function calciteWeightAt([x, y, z], spec) {
  return Math.max(
    0,
    ...spec.stalagmites.map((c) => {
      if (z > c.top + 1) return 0;
      const edge =
        1 -
        smooth(c.radius - 0.25, c.radius + 0.05, Math.hypot(x - c.x, y - c.y));
      return edge * smooth(c.base + 0.5, c.base + 2.3, z);
    }),
  );
}
export function paintStalagmites(p, n, ao, spec) {
  const rock = caveRockPixel(p, n, ao, spec),
    weight = calciteWeightAt(p, spec);
  if (weight === 0) return rock;
  const grain = 1 + (surfaceNoise(...p.map((v) => v * 0.33)) - 0.5) * 0.18;
  const layer = 1 + Math.sin(p[2] * 2.3) * 0.035;
  const clean = 0.78 + 0.22 * clamp((ao / 255 - 0.65) / 0.35);
  const colour = spec.calcite.tint.map(
    (v, i) => srgbToLinear(v) * grain * layer * clean,
  );
  return {
    part: weight > 0.05 ? "calcite" : "rock",
    rgb: rock.rgb.map((v, i) =>
      Math.round(
        clamp(srgb(srgbToLinear(v / 255) * (1 - weight) + colour[i] * weight)) *
          255,
      ),
    ),
    roughness: rock.roughness * (1 - weight) + spec.calcite.roughness * weight,
    metallic: 0,
  };
}
