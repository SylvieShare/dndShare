import { fitBakedMaterials } from "./material_mixture.mjs";
import { OLD_STONE, srgbToLinear } from "./masonry_palette.mjs";
import { paintStone } from "./ultimate_surface.mjs";
import { finishWood, finishCloth } from "./organic_finish.mjs";
const detailAt = fitBakedMaterials([
  OLD_STONE,
  [0.39, 0.22, 0.105],
  [0.39, 0.17, 0.14],
  [0.57, 0.49, 0.29],
]);
const srgb = (v) =>
  v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055;
function postAt([x, y, z]) {
  if (z < 15.4 || Math.abs(y) < 9 || Math.abs(y) > 13.3) return null;
  if (x > -21 && x < -17.1 && z < 31) return [-19.1, Math.sign(y) * 11.3, 22];
  if (x > 23 && x < 27.75 && z < 35.2) return [25.3, Math.sign(y) * 11.3, 25];
  return null;
}
export function bedPartAt(p, spec = {}) {
  const [x, y, z] = p;
  if (postAt(p)) return "wood";
  if (
    spec.extraDrape &&
    x > 12.3 &&
    x < 18.5 &&
    Math.abs(y) < 16.2 &&
    z > 20.3 &&
    z < 28.7
  )
    return "cloth";
  if (x > -18.5 && x < 12.4 && Math.abs(y) < 15.5 && z > 19.6) return "cloth";
  if (x > -20.8 && x < 27.3 && Math.abs(y) < 15.25 && z > 16.0 && z <= 19.6)
    return "wood";
  if (x < -21 || x > 27.75 || Math.abs(y) > 13.45 || z < 15.5) return "stone";
  if (x > 12 && x < 24.6 && Math.abs(y) < 10.6 && z > 28.6) return "pillow";
  if (x > 12.3 && Math.abs(y) < 10.8 && z > 24.2) return "straw";
  if (x > -18.5 && x < 12.4 && Math.abs(y) < 13.4 && z > 21.3) return "cloth";
  return "wood";
}
export function makeBedPainter(spec) {
  return (rgb, p, n) => {
    const part = bedPartAt(p, spec),
      detail = detailAt(rgb),
      [x, y, z] = p;
    if (part === "stone") {
      const stone = OLD_STONE.map((v) =>
        Math.round(Math.min(1, srgb(srgbToLinear(v) * detail)) * 255),
      );
      return { ...paintStone(stone, p, n), part: "stone" };
    }
    if (part === "wood") {
      const post = postAt(p),
        axis = post ? "z" : x < -17 || x > 23 ? "y" : "x";
      return finishWood(detail, p, n, axis, post ?? [0, 0, 21]);
    }
    if (part === "pillow")
      return finishCloth(detail, p, n, [0.66, 0.615, 0.48], "pillow");
    if (part === "straw") {
      const variation = 1 + 0.06 * Math.sin(y * 5 + x * 0.19);
      return {
        part,
        rgb: [0.59, 0.52, 0.34].map((v) =>
          Math.round(
            Math.min(1, srgb(srgbToLinear(v) * detail * variation)) * 255,
          ),
        ),
        roughness: 0.96,
        metallic: 0,
      };
    }
    let tint = spec.blanketColor ?? [0.56, 0.545, 0.43];
    const patches = spec.patches ?? [
      {
        x: [-14, 1.5],
        y: [1.8, 10.7],
        color: spec.patchOne ?? [0.665, 0.625, 0.48],
      },
      {
        x: [-17.2, -2],
        y: [-10.5, -2.3],
        color: spec.patchTwo ?? [0.49, 0.515, 0.405],
      },
    ];
    for (const patch of patches)
      if (x > patch.x[0] && x < patch.x[1] && y > patch.y[0] && y < patch.y[1])
        tint = patch.color;
    return finishCloth(detail, p, n, tint);
  };
}
