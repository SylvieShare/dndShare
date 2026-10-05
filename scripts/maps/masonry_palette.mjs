// PDF reference: cool grey masonry; retain the existing baked grain and wear.
export const MASONRY_REVISION = "ultimate-grey-stone-v1";
export const OLD_STONE = [0.54, 0.51, 0.45];
export const STONE = [0.34, 0.375, 0.39];
export const PEG = [0.27, 0.3, 0.315];
export const srgbToLinear = (v) =>
  v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
const linearToSrgb = (v) =>
  v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055;
const old = OLD_STONE.map(srgbToLinear);
const factors = STONE.map((v, i) => srgbToLinear(v) / old[i]);
const chroma = old.map((v) => v / Math.max(...old));
const linear = Array.from({ length: 256 }, (_, i) => srgbToLinear(i / 255));

export function masonryWeight(rgb) {
  const values = rgb.map((v) => linear[v]);
  const maximum = Math.max(...values);
  if (maximum < 0.0001) return 0;
  const distance = Math.hypot(...values.map((v, i) => v / maximum - chroma[i]));
  const t = Math.max(0, Math.min(1, (0.115 - distance) / 0.06));
  return t * t * (3 - 2 * t);
}

export function recolorMasonry(data, channels) {
  const result = Buffer.from(data);
  let affected = 0,
    full = 0;
  for (let i = 0; i < data.length; i += channels) {
    const weight = masonryWeight([data[i], data[i + 1], data[i + 2]]);
    if (weight <= 0) continue;
    affected++;
    if (weight > 0.99) full++;
    for (let c = 0; c < 3; c++) {
      const value = linear[data[i + c]] * (1 + weight * (factors[c] - 1));
      result[i + c] = Math.round(
        Math.max(0, Math.min(1, linearToSrgb(value))) * 255,
      );
    }
  }
  return { data: result, affected, full, pixels: data.length / channels };
}
