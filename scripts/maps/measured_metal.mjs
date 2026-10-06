// Explicit material boundaries on the fused stone/iron printing meshes.
import { paintStone, stoneDetail } from "./ultimate_surface.mjs";
import { pairDetail } from "./raised_material.mjs";
import { surfaceNoise } from "./surface_noise.mjs";
import { srgbToLinear, OLD_STONE } from "./masonry_palette.mjs";
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const toSrgb = (v) =>
  v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055;
export function windowIronAt([x, y, z]) {
  const inside =
    Math.abs(y) < 7.35 &&
    z < 41.2 + Math.sqrt(Math.max(0, 7.7 ** 2 - y * y)) - 0.25;
  return x > 12 && x < 15.8 && z > 29.1 && inside;
}
export function makeMetalPainter(spec) {
  const mask =
    spec.material === "iron-window"
      ? windowIronAt
      : spec.material === "iron-chains"
        ? ([x, y, z]) => x < 9.9 && z > 14.35
        : null;
  if (!mask) throw new Error("Unknown metal mask");
  return (rgb, p, n) => {
    const detail = spec.originalIron
      ? pairDetail(rgb, [0.34, 0.35, 0.33])
      : stoneDetail(rgb);
    const reconstructed = OLD_STONE.map((v) =>
      Math.round(clamp(toSrgb(srgbToLinear(v) * detail)) * 255),
    );
    if (!mask(p)) return { ...paintStone(reconstructed, p, n), part: "stone" };
    const [x, y, z] = p,
      grain = surfaceNoise(x * 3, y * 3, z * 3),
      age = surfaceNoise(x * 0.24, y * 0.24, z * 0.24);
    const rust = Math.max(0, age - 0.64) * 0.12;
    const edge = Math.max(0, detail - 1.05) * 0.18;
    const rgbOut = (spec.ironColor ?? [0.19, 0.205, 0.22]).map((v, i) => {
      const iron = srgbToLinear(v) * detail * (1 + (grain - 0.5) * 0.13);
      const wear = srgbToLinear([0.37, 0.38, 0.385][i]);
      const patina = srgbToLinear([0.33, 0.205, 0.105][i]);
      return Math.round(
        clamp(toSrgb(iron * (1 - edge - rust) + wear * edge + patina * rust)) *
          255,
      );
    });
    return {
      part: "iron",
      rgb: rgbOut,
      roughness: clamp(0.62 + (grain - 0.5) * 0.12, 0.53, 0.75),
      metallic: spec.metallic ?? 0.68,
    };
  };
}
