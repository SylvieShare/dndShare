import { fitBakedMaterials } from "./material_mixture.mjs";
import { paintStone } from "./ultimate_surface.mjs";
import { finishBone } from "./bone_finish.mjs";
import { OLD_STONE, srgbToLinear } from "./masonry_palette.mjs";
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const srgb = (v) =>
  v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055;
export function waterPartAt([x, y, z], spec) {
  if (spec.variant === "rocks" && z > spec.stoneMinZ) return "stone";
  if (spec.variant === "well")
    return Math.hypot(x - spec.centre[0], y - spec.centre[1]) < spec.radius &&
      z > spec.waterMinZ &&
      z < spec.waterMaxZ
      ? "water"
      : "stone";
  if (
    spec.heads?.some(
      (h) =>
        [x, y, z].reduce(
          (sum, v, i) => sum + ((v - h.centre[i]) / h.radius[i]) ** 2,
          0,
        ) < 1.05,
    )
  )
    return "bone";
  if (
    spec.bones?.some((b) => {
      const [a, c] = b.line,
        dx = c[0] - a[0],
        dy = c[1] - a[1];
      const t = clamp(
        ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy),
      );
      return (
        z > b.minZ &&
        (Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy) < b.radius ||
          [a, c].some(([cx, cy]) => Math.hypot(x - cx, y - cy) < b.jointRadius))
      );
    })
  )
    return "bone";
  return z > spec.waterMinZ ? "water" : "stone";
}
export function makeWaterPainter(spec) {
  const detailAt = fitBakedMaterials([
    OLD_STONE,
    [0.16, 0.37, 0.43],
    [0.79, 0.72, 0.52],
  ]);
  return (rgb, p, n, ao) => {
    const part = waterPartAt(p, spec),
      d = detailAt(rgb);
    if (part === "bone") return finishBone(d, p, ao, spec.boneGroups);
    if (part === "stone")
      return {
        ...paintStone(
          OLD_STONE.map((v) =>
            Math.round(clamp(srgb(srgbToLinear(v) * d)) * 255),
          ),
          p,
          n,
          { datum: spec.stoneDatum ?? 13.4 },
        ),
        part,
      };
    const crest = clamp((d - 1.02) * 0.22, 0, 0.16),
      side = n[2] < 0.35 ? 0.7 : 1;
    return {
      part,
      rgb: [0.265, 0.48, 0.57].map((v, i) =>
        Math.round(
          clamp(
            srgb(
              (srgbToLinear(v) * clamp(d, 0.65, 1.4) * (1 - crest) +
                srgbToLinear([0.52, 0.7, 0.72][i]) * crest) *
                side,
            ),
          ) * 255,
        ),
      ),
      roughness: 0.23,
      metallic: 0,
    };
  };
}
