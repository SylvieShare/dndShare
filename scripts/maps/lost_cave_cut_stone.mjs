import { caveRockPixel } from "./lost_cave_surface.mjs";
import { surfaceNoise } from "./surface_noise.mjs";
import { srgbToLinear } from "./masonry_palette.mjs";
const clamp = (v) => Math.max(0, Math.min(1, v));
const srgb = (v) =>
  v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055;
export function cutStonePartAt(p, n, spec) {
  const c = spec.cutStone,
    edge = Math.max(Math.abs(p[0]), Math.abs(p[1]));
  const floor =
    edge <= c.innerHalfMM + 0.15 &&
    Math.abs(p[2] - c.floorMM) < 0.2 &&
    n[2] > 0.1;
  const wall =
    Math.abs(edge - c.innerHalfMM) < 0.2 &&
    p[2] >= c.floorMM - 0.2 &&
    p[2] <= c.topMM + 0.1 &&
    p[0] * n[0] + p[1] * n[1] < 0;
  return floor || wall ? "cut-stone" : "rock";
}
export function paintCutStone(p, n, ao, spec) {
  const part = cutStonePartAt(p, n, spec);
  if (part === "rock") return caveRockPixel(p, n, ao, spec);
  const c = spec.cutStone;
  const grain =
    1 +
    (surfaceNoise(...p.map((v) => v * 0.35)) - 0.5) * 0.12 +
    (surfaceNoise(...p.map((v) => v * 3)) - 0.5) * 0.03;
  const dirt = (1 - clamp((ao / 255 - 0.65) / 0.35)) * 0.2;
  const dust = n[2] > 0.8 ? 0.025 : 0;
  return {
    part,
    rgb: c.tint.map((v, i) =>
      Math.round(
        255 *
          clamp(
            srgb(
              srgbToLinear(v) * grain * (1 - dirt) +
                srgbToLinear(spec.palette.dust[i]) * dust,
            ),
          ),
      ),
    ),
    roughness: c.roughness + dirt * 0.2,
    metallic: 0,
  };
}
