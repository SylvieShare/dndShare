import { fitBakedMaterials } from "./material_mixture.mjs";
import { finishWood } from "./organic_finish.mjs";
import { paintStone } from "./ultimate_surface.mjs";
import { OLD_STONE, srgbToLinear } from "./masonry_palette.mjs";
const srgb = (v) =>
  v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055;
const detailAt = fitBakedMaterials([OLD_STONE, [0.39, 0.22, 0.105]]);
const nails = [
  [-14.2036, 12.7091, 10.7203],
  [-10.5118, 13.7846, 11.3824],
  [-3.5896, 11.5783, 12.089],
  [1.4353, 11.941, 10.2241],
  [7.5884, 14.4022, 10.2297],
  [13.6388, 12.4534, 10.4154],
  [-14.3061, -12.5703, 11.0996],
  [-10.6656, -14.776, 11.5158],
  [-2.9743, -15.2343, 9.9354],
  [1.743, -14.0039, 10.0725],
  [7.7935, -14.9786, 10.2645],
  [14.049, -14.5695, 10.8095],
];
export function woodFloorPartAt([x, y, height], spec = {}) {
  if (spec.wall && x > 9.75) return "stone";
  const z = height - (spec.heightOffset ?? 0);
  if (
    nails.some(
      ([cx, cy, cz]) => Math.hypot(x - cx, y - cy) < 1.07 && z > cz - 0.65,
    )
  )
    return "iron";
  return z > 8.3 ? "wood" : "stone";
}
export function paintWoodFloor(rgb, p, n, spec = {}) {
  const d = detailAt(rgb),
    part = woodFloorPartAt(p, spec);
  if (part === "stone")
    return {
      ...paintStone(
        OLD_STONE.map((v) =>
          Math.round(Math.min(1, srgb(srgbToLinear(v) * d)) * 255),
        ),
        p,
        n,
        { datum: spec.wall ? 13.4 : 8.3 },
      ),
      part,
    };
  if (part === "wood") {
    const board = [-12.2, -6.7, 0.1, 4.2, 10.6].filter((x) => p[0] > x).length;
    const variation = [0.93, 1.08, 0.96, 1.05, 0.91, 1.03][board];
    return finishWood(
      d,
      p,
      n,
      "y",
      [0, 0, 9.5],
      [0.335, 0.285, 0.215].map((v) => v * variation),
    );
  }
  return {
    part,
    rgb: [0.41, 0.435, 0.445].map((v) =>
      Math.round(Math.min(1, srgb(srgbToLinear(v) * d)) * 255),
    ),
    roughness: 0.57,
    metallic: 0.67,
  };
}
