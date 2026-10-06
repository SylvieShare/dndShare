import { fitBakedMaterials } from "./material_mixture.mjs";
import { paintStone } from "./ultimate_surface.mjs";
import { OLD_STONE, srgbToLinear } from "./masonry_palette.mjs";
import { surfaceNoise } from "./surface_noise.mjs";
import { addedDistance } from "./added_bones.mjs";
import { finishWood } from "./organic_finish.mjs";
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const srgb = (v) =>
  v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055;
export function utilityPartAt([x, y, z], spec, bare) {
  if (spec.variant === "pit")
    return z > 5.35 &&
      spec.posts.some(([cx, cy, r]) => Math.hypot(x - cx, y - cy) < r)
      ? "wood"
      : "stone";
  if (spec.variant === "lever")
    return Math.abs(x) < 14.6 &&
      (y > 6.6 || (z > 20 && x > 3.5 && x < 10.5 && y > 4.8)) &&
      y < 17 &&
      z > 14.6
      ? "iron"
      : "stone";
  if (spec.variant === "poison") {
    if (!bare) throw new Error("Bare grate reference required");
    if (z > 6.2 && addedDistance([x, y, z], bare) > 0.35) return "toxic";
    return Math.abs(x) < 14.8 && Math.abs(y) < 14.8 && z > 6.75
      ? "iron"
      : "stone";
  }
  if (spec.variant === "grate")
    return Math.abs(x) < 14.8 && Math.abs(y) < 14.8 && z > 13.65
      ? "iron"
      : "stone";
  throw new Error("Unreviewed utility material");
}
export function makeUtilityPainter(spec, bare) {
  const detailAt = fitBakedMaterials([
    OLD_STONE,
    [0.34, 0.35, 0.33],
    ...(spec.oldPigments ?? []),
  ]);
  return (rgb, p, n) => {
    const part = utilityPartAt(p, spec, bare),
      d = detailAt(rgb);
    if (part === "wood") {
      const post = spec.posts.find(
        ([cx, cy, r]) => Math.hypot(p[0] - cx, p[1] - cy) < r,
      );
      return finishWood(
        d,
        p,
        n,
        "z",
        [post[0], post[1], 5.2],
        [0.34, 0.265, 0.185],
      );
    }
    if (part === "toxic") {
      const foam = clamp((d - 1.02) * 0.25, 0, 0.1);
      return {
        part,
        rgb: [0.61, 0.77, 0.14].map((v, i) =>
          Math.round(
            clamp(
              srgb(
                srgbToLinear(v) * clamp(d, 0.8, 1.3) * (1 - foam) +
                  srgbToLinear([0.84, 0.87, 0.29][i]) * foam,
              ),
            ) * 255,
          ),
        ),
        roughness: 0.28,
        metallic: 0,
      };
    }
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
    const grain = surfaceNoise(...p.map((v) => v * 2.8)),
      wear = clamp((d - 1.03) * 0.25, 0, 0.16);
    return {
      part,
      rgb: [0.34, 0.355, 0.305].map((v, i) =>
        Math.round(
          clamp(
            srgb(
              srgbToLinear(v) * d * (1 - wear) +
                srgbToLinear([0.54, 0.55, 0.495][i]) * wear,
            ),
          ) * 255,
        ),
      ),
      roughness: 0.62 + (grain - 0.5) * 0.1,
      metallic: 0.67,
    };
  };
}
