import { fitBakedMaterials } from "./material_mixture.mjs";
import { paintStone } from "./ultimate_surface.mjs";
import { finishBone } from "./bone_finish.mjs";
import { finishCloth } from "./organic_finish.mjs";
import { addedDistance } from "./added_bones.mjs";
import { OLD_STONE, srgbToLinear } from "./masonry_palette.mjs";
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const srgb = (v) =>
  v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055;
export function altarPartAt([x, y, z], spec, bare) {
  const sheetWidth = Math.abs(y) > 24 ? 11.6 : 10.2;
  const touchingSheet = z > 36.9 && Math.abs(x) < 5 && Math.abs(y) < 27.8;
  if (
    spec.sheet &&
    z > 28 &&
    Math.abs(x) < sheetWidth &&
    Math.abs(y) < 29.5 &&
    (touchingSheet || addedDistance([x, y, z], bare) > 0.38)
  )
    return "cloth";
  const foot = [-12, 12].some((cx) =>
    [-22, 22].some((cy) => Math.hypot(x - cx, y - cy) < 3.1),
  );
  if (
    spec.extraHeads?.some(
      (h) =>
        z > h.minZ &&
        [x, y, z].reduce(
          (sum, v, i) => sum + ((v - h.centre[i]) / h.radius[i]) ** 2,
          0,
        ) < 1.05,
    )
  )
    return "bone";
  if (
    !foot &&
    z > 15.0 &&
    z < 23.3 &&
    ((Math.abs(y) > 22.3 && Math.abs(y) < 33 && Math.abs(x) < 14.2) ||
      (x < -8.05 && x > -11.1 && Math.abs(y) < 19.5 && z > 16.6))
  )
    return "bone";
  const side =
    x > 9.9 &&
    x < 10.9 &&
    ((Math.abs(y) < 4.2 && z > 17.2 && z < 27) ||
      (Math.abs(y) > 11 && Math.abs(y) < 18.3 && z > 17.8 && z < 27.5));
  const end =
    Math.abs(y) > 19.8 &&
    Math.abs(y) < 21.0 &&
    Math.abs(x) < 5.4 &&
    z > 18 &&
    z < 28;
  return side || end ? "gold" : "stone";
}
export function makeAltarPainter(spec, bare) {
  const detailAt = fitBakedMaterials([
    OLD_STONE,
    [0.39, 0.17, 0.14],
    [0.79, 0.72, 0.52],
  ]);
  return (rgb, p, n, ao) => {
    const part = altarPartAt(p, spec, bare),
      d = detailAt(rgb);
    if (part === "cloth")
      return finishCloth(d, p, n, [0.57, 0.32, 0.245], part);
    if (part === "bone") return finishBone(d, p, ao, spec.boneGroups);
    if (part === "stone")
      return {
        ...paintStone(
          OLD_STONE.map((v) =>
            Math.round(clamp(srgb(srgbToLinear(v) * d)) * 255),
          ),
          p,
          n,
        ),
        part,
      };
    const wear = clamp((d - 1.02) * 0.3, 0, 0.15);
    return {
      part,
      rgb: [0.61, 0.49, 0.2].map((v, i) =>
        Math.round(
          clamp(
            srgb(
              srgbToLinear(v) * d * (1 - wear) +
                srgbToLinear([0.78, 0.64, 0.3][i]) * wear,
            ),
          ) * 255,
        ),
      ),
      roughness: 0.5,
      metallic: 0.7,
    };
  };
}
