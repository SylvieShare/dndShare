import { surfaceNoise } from "./surface_noise.mjs";
import { srgbToLinear } from "./masonry_palette.mjs";
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const srgb = (v) =>
  v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055;
export function caveRockPixel(p, n, ao, spec) {
  const [x, y, z] = p;
  const strata =
    Math.sin(z * 0.36 + surfaceNoise(x * 0.08, y * 0.08, z * 0.04) * 1.8) *
    0.07;
  const mineral = (surfaceNoise(x * 0.22, y * 0.22, z * 0.22) - 0.5) * 0.55;
  const inclusion =
    smooth(0.5, 0.8, surfaceNoise(x * 0.11, y * 0.11, z * 0.11)) * 0.32;
  const fine = (surfaceNoise(x * 3.1, y * 3.1, z * 3.1) - 0.5) * 0.12;
  const recess = (1 - clamp((ao / 255 - 0.65) / 0.35)) * 0.54;
  const dusty =
    smooth(0.4, 0.95, n[2]) *
    (0.08 + smooth(spec.floorHeightMM + 5, spec.floorHeightMM, z) * 0.16);
  const palette = spec.palette;
  const rgb = palette.rock.map((v, i) => {
    const base =
      (srgbToLinear(v) * (1 - inclusion) +
        srgbToLinear(palette.mineral[i]) * inclusion) *
      (1 + mineral + fine + strata);
    return Math.round(
      clamp(
        srgb(
          base * (1 - recess - dusty) +
            srgbToLinear(palette.recess[i]) * recess +
            srgbToLinear(palette.dust[i]) * dusty,
        ),
      ) * 255,
    );
  });
  return {
    part: "rock",
    rgb,
    roughness: clamp(0.89 + fine * 0.4 + dusty * 0.2, 0.84, 0.97),
    metallic: 0,
  };
}
export function darkenCaveFloorJoints(value, p, spec) {
  const depth = spec.floorHeightMM - p[2];
  if (depth > 0.25 && depth < 3)
    value.rgb = value.rgb.map((v) =>
      Math.round(v * (1 - Math.min(1, depth / 1.5) * 0.22)),
    );
  return value;
}
