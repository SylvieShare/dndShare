// Physical surface colours, independent of UV orientation and camera lighting.
import { srgbToLinear, OLD_STONE } from "./masonry_palette.mjs";
import { surfaceNoise } from "./surface_noise.mjs";
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const smooth = (a, b, v) => {
  const t = clamp((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const linear = Array.from({ length: 256 }, (_, i) => srgbToLinear(i / 255));
const toSrgb = (v) =>
  v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055;
const old = OLD_STONE.map(srgbToLinear);
export function stoneDetail(rgb) {
  const ratios = rgb.map((v, i) => linear[v] / old[i]).sort((a, b) => a - b);
  return clamp(0.9 + (ratios[1] - 0.9) * 1.3, 0.38, 1.44);
}
export function paintStone(rgb, [x, y, z], [nx, ny, nz], options = {}) {
  const datum = options.datum ?? 13.4;
  const part = z < datum ? "base" : z < datum + 2.5 ? "floor" : "wall";
  const d = stoneDetail(rgb);
  const mottling = (surfaceNoise(x * 0.16, y * 0.16, z * 0.16) - 0.5) * 0.18;
  const grain = (surfaceNoise(x * 3.6, y * 3.6, z * 3.6) - 0.5) * 0.14;
  const edge = smooth(1.06, 1.36, d) * 0.07;
  const dust = smooth(0.6, 0.96, nz) * (part === "floor" ? 0.045 : 0.02);
  const damp =
    (1 - smooth(datum + 1, datum + 7, z)) * (part === "base" ? 0 : 0.05);
  let palette = part === "base" ? [0.285, 0.315, 0.33] : [0.335, 0.37, 0.39];
  if (options.loose && x < 9.9 && z > 14.55) palette = [0.385, 0.41, 0.425];
  const color = palette.map((v, i) => {
    const base = srgbToLinear(v) * d * (1 + mottling + grain);
    const wear = srgbToLinear([0.49, 0.5, 0.495][i]);
    const dirt = srgbToLinear([0.29, 0.32, 0.28][i]);
    return Math.round(
      clamp(
        toSrgb(
          base * (1 - edge - dust - damp) + wear * (edge + dust) + dirt * damp,
        ),
      ) * 255,
    );
  });
  return {
    part,
    rgb: color,
    roughness: clamp(0.88 + grain * 0.6 + dust * 0.35, 0.82, 0.96),
    metallic: 0,
  };
}
