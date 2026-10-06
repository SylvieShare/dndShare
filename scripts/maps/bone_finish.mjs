// Worn ivory with restrained age variation and dirt in actual concavities.
import { surfaceNoise } from "./surface_noise.mjs";
import { srgbToLinear } from "./masonry_palette.mjs";
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const smooth = (a, b, v) => {
  const t = clamp((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const toSrgb = (v) =>
  v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055;
const palette = {
  ivory: [0.85, 0.805, 0.665],
  old: [0.56, 0.465, 0.315],
  grey: [0.685, 0.685, 0.63],
  dirt: [0.375, 0.3, 0.205],
};
function boneTint(point, groups) {
  let first,
    second,
    d1 = Infinity,
    d2 = Infinity;
  for (const group of groups) {
    const d = group.position.reduce(
      (sum, v, i) => sum + (v - point[i]) ** 2,
      0,
    );
    if (d < d1) {
      second = first;
      d2 = d1;
      first = group;
      d1 = d;
    } else if (d < d2) {
      second = group;
      d2 = d;
    }
  }
  const tones = {
    ivory: [0.845, 0.8, 0.67],
    old: [0.64, 0.555, 0.4],
    grey: [0.675, 0.68, 0.615],
  };
  const weight = 0.5 + 0.5 * smooth(0, 1.6, Math.sqrt(d2) - Math.sqrt(d1));
  return tones[first.tone].map(
    (v, i) =>
      srgbToLinear(v) * weight +
      srgbToLinear(tones[second?.tone ?? first.tone][i]) * (1 - weight),
  );
}
export function finishBone(detail, [x, y, z], ao = 255, groups) {
  const age = surfaceNoise(x * 0.21 + 8, y * 0.21 - 4, z * 0.21 + 2);
  const cool = surfaceNoise(x * 0.11 - 3, y * 0.11 + 7, z * 0.11 + 11);
  const grain = 1 + (surfaceNoise(x * 5, y * 5, z * 5) - 0.5) * 0.08;
  const worn = smooth(0.97, 1.25, detail) * 0.42;
  const dirty =
    (1 - smooth(0.61, 0.94, detail)) * 0.42 +
    (1 - smooth(0.77, 0.94, ao / 255)) * 0.16;
  const grey = smooth(0.28, 0.72, cool) * 0.6;
  const aged = smooth(0.29, 0.69, age) * 0.82 * (1 - grey);
  const tint = groups ? boneTint([x, y, z], groups) : null;
  const rgb = [0, 1, 2].map((i) => {
    const base =
      srgbToLinear(palette.ivory[i]) * (1 - aged - grey) +
      srgbToLinear(palette.old[i]) * aged +
      srgbToLinear(palette.grey[i]) * grey;
    const pigmented = tint ? tint[i] * (0.96 + age * 0.08) : base;
    const cleaned =
      pigmented * (1 - worn) + srgbToLinear(palette.ivory[i]) * worn;
    return Math.round(
      clamp(
        toSrgb(
          (cleaned * (1 - dirty) + srgbToLinear(palette.dirt[i]) * dirty) *
            detail *
            grain,
        ),
      ) * 255,
    );
  });
  return {
    part: "bone",
    rgb,
    roughness: clamp(0.8 + aged * 0.12 + dirty * 0.18, 0.8, 0.96),
    metallic: 0,
  };
}
