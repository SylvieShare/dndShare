import { fitBakedMaterials } from "./material_mixture.mjs";
import { finishWood, finishCloth } from "./organic_finish.mjs";
import { paintStone } from "./ultimate_surface.mjs";
import { OLD_STONE, srgbToLinear } from "./masonry_palette.mjs";
import { surfaceNoise } from "./surface_noise.mjs";
import { addedDistance } from "./added_bones.mjs";
const srgb = (v) =>
  v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055;
const ellipse = (x, y, cx, cy, rx, ry) =>
  ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < 1;
const plates = [
  [-7.8, 9, 4.85],
  [10, 10.05, 4.65],
  [-7.2, -10.1, 5.0],
  [9.8, -10.7, 4.65],
];
const cups = [
  [-0.78, 12.9, 2.5],
  [10.98, 3.04, 2.5],
  [10.3, -4.18, 2.5],
  [-12.7, -5.65, 2.5],
  [-9.3, 0.25, 3.05],
];
const spoons = [
  [
    [-13.49, 12.74],
    [-13.65, 5.39],
  ],
  [
    [4.46, 15.25],
    [2.34, 7.9],
  ],
  [
    [1.0, -12.17],
    [-3.12, -5.09],
  ],
  [
    [14.99, -15.51],
    [14.43, -7.21],
  ],
];
function spoonAt(x, y) {
  return spoons.some(([a, b]) => {
    const dx = b[0] - a[0],
      dy = b[1] - a[1];
    const t = Math.max(
      0,
      Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy)),
    );
    const radius = t > 0.77 ? 1.6 : 0.86;
    return Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy) < radius;
  });
}
export function tablePartAt([x, y, z], full = true, bench = false) {
  if (z < 14.9) return "stone";
  if (bench) {
    const seat = z > 18.3 && Math.abs(x) < 16 && y > 6.1 && y < 15.6;
    const leg =
      ((x > -14.6 && x < -3.1) || (x > 1.4 && x < 13.8)) &&
      y > 6.1 &&
      y < 14.8 &&
      z > 15.15;
    return seat || leg ? "wood" : "stone";
  }
  if (z < 18.6 && !(Math.abs(x) > 8.4 && Math.abs(y) > 8.4)) return "stone";
  if (!full || z < 28.05) return "wood";
  if (
    (ellipse(x, y, -3.18, 1.64, 1.95, 2.25) && z > 33.3) ||
    (ellipse(x, y, 2.01, 0.69, 2.3, 2.25) && z > 33.3) ||
    (ellipse(x, y, -1.45, -2.54, 2.25, 2.15) && z > 33.3)
  )
    return "fruit";
  if (Math.hypot(x, y) < 5.15 && z > 29.3) return "basket";
  if (cups.some(([cx, cy, r]) => ellipse(x, y, cx, cy, r, r))) return "ceramic";
  if (plates.some(([cx, cy, r]) => ellipse(x, y, cx, cy, r, r))) return "plate";
  if (spoonAt(x, y)) return "iron";
  return "wood";
}
export function makeTablePainter(spec, bare) {
  const detailAt = fitBakedMaterials([
    OLD_STONE,
    [0.39, 0.22, 0.105],
    [0.69, 0.61, 0.45],
    [0.47, 0.55, 0.23],
  ]);
  return (rgb, p, n) => {
    const d = detailAt(rgb);
    let part = tablePartAt(p, spec.full, spec.bench);
    if (
      bare &&
      !["stone", "wood"].includes(part) &&
      addedDistance(p, bare) < 0.3 &&
      !(part === "plate" ? plates : part === "ceramic" ? cups : []).some(
        ([x, y, r]) => ellipse(p[0], p[1], x, y, r * 0.82, r * 0.82),
      )
    )
      part = "wood";
    if (part === "stone")
      return {
        ...paintStone(
          OLD_STONE.map((v) => Math.round(srgb(srgbToLinear(v) * d) * 255)),
          p,
          n,
        ),
        part,
      };
    if (part === "wood")
      return finishWood(
        d,
        p,
        n,
        p[2] < (spec.seatHeight ?? 25.7) ? "z" : (spec.boardAxis ?? "y"),
        [0, 0, 27],
        [0.335, 0.29, 0.225],
      );
    if (part === "basket")
      return {
        ...finishCloth(d, p, n, [0.4, 0.335, 0.21]),
        part,
        roughness: 0.89,
      };
    let tint,
      roughness = 0.78,
      metallic = 0;
    if (part === "plate") tint = [0.64, 0.565, 0.345];
    else if (part === "ceramic") {
      tint = ellipse(p[0], p[1], -9.3, 0.25, 3.05, 3.05)
        ? [0.455, 0.32, 0.205]
        : [0.25, 0.265, 0.245];
      roughness = 0.63;
    } else if (part === "iron") {
      tint = [0.45, 0.475, 0.485];
      roughness = 0.46;
      metallic = 0.72;
    } else {
      const centres = [
          [-3.18, 1.64],
          [2.01, 0.69],
          [-1.45, -2.54],
        ],
        index = centres
          .map(([x, y]) => Math.hypot(p[0] - x, p[1] - y))
          .reduce((best, v, i, a) => (v < a[best] ? i : best), 0);
      tint = [
        [0.67, 0.59, 0.23],
        [0.38, 0.465, 0.21],
        [0.525, 0.235, 0.17],
      ][index];
      roughness = 0.7;
    }
    const age = 1 + (surfaceNoise(...p.map((v) => v * 0.6)) - 0.5) * 0.12;
    return {
      part,
      rgb: tint.map((v) =>
        Math.round(Math.min(1, srgb(srgbToLinear(v) * d * age)) * 255),
      ),
      roughness,
      metallic,
    };
  };
}
