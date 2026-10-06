import { fitBakedMaterials } from "./material_mixture.mjs";
import { finishWood } from "./organic_finish.mjs";
import { paintStone } from "./ultimate_surface.mjs";
import { OLD_STONE, srgbToLinear } from "./masonry_palette.mjs";
const srgb = (v) =>
  v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055;
const detailAt = fitBakedMaterials([
  OLD_STONE,
  [0.39, 0.22, 0.105],
  [0.34, 0.35, 0.33],
]);
export function barrelPartAt([x, y, z]) {
  if (x > 9.75 || z < 15.3) return "stone";
  const radius = Math.hypot(y + 1.6, z - 25.3);
  if (
    x > -4.05 &&
    x < 0.6 &&
    ((Math.abs(y) > 12.8 && z > 19.3) || (radius > 12.0 && z > 21))
  )
    return "chain";
  if (
    z > 17.4 &&
    radius > (x < -13.85 ? 8.8 : 9.7) &&
    radius < 13.55 &&
    (z > 21 || Math.abs(y + 1.6) < 8.7) &&
    ((x > -8.1 && x < -5.55) || (x > 1.9 && x < 4.35) || x < -13.85 || x > 7.6)
  )
    return "hoop";
  const foot =
    (x < -10.9 || x > 5.1) && Math.abs(y) > 9.4 && Math.abs(y) < 14.8;
  if (z < 16.3 && !foot) return "stone";
  return "wood";
}
export function paintBarrel(rgb, p, n) {
  const d = detailAt(rgb),
    part = barrelPartAt(p);
  if (part === "stone")
    return {
      ...paintStone(
        OLD_STONE.map((v) =>
          Math.round(Math.min(1, srgb(srgbToLinear(v) * d)) * 255),
        ),
        p,
        n,
      ),
      part,
    };
  if (part === "wood") {
    const radius = Math.hypot(p[1] + 1.6, p[2] - 25.3);
    const axis =
      p[0] < -13.6 || (radius < 10 && p[0] > 7.4)
        ? "z"
        : p[2] < 20.2
          ? "z"
          : "x";
    return finishWood(d, p, n, axis, [-2, -1.6, 25.3], [0.335, 0.285, 0.215]);
  }
  const tint = part === "chain" ? [0.265, 0.28, 0.29] : [0.37, 0.395, 0.405];
  return {
    part,
    rgb: tint.map((v) =>
      Math.round(Math.min(1, srgb(srgbToLinear(v) * d)) * 255),
    ),
    roughness: part === "chain" ? 0.65 : 0.54,
    metallic: 0.67,
  };
}
