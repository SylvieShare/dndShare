import { fitBakedMaterials } from "./material_mixture.mjs";
import { paintStone } from "./ultimate_surface.mjs";
import { finishBone } from "./bone_finish.mjs";
import { OLD_STONE, srgbToLinear } from "./masonry_palette.mjs";
import { surfaceNoise } from "./surface_noise.mjs";
import { rackPartAt } from "./rack_material.mjs";
import { finishWood } from "./organic_finish.mjs";
import { chairPartAt } from "./chair_material.mjs";
import { woodenTrapPartAt, trapWoodFrame } from "./wooden_trap_material.mjs";
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const srgb = (v) =>
  v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055;
export function tortureCagePartAt([x, y, z]) {
  const radius = Math.hypot(x + 2, y);
  if (radius < 9.6 && z > 15.6 && z < 22.5) return "bone";
  const lock =
    x > -10.5 && x < 5.5 && y < -9.5 && y > -15.5 && z > 21 && z < 46;
  if (z > 15.5 && x < 11.3 && (radius < 13.7 || lock)) return "iron";
  return "stone";
}
export function makeTorturePainter(spec) {
  const detailAt = fitBakedMaterials([
    OLD_STONE,
    [0.34, 0.35, 0.33],
    [0.39, 0.22, 0.105],
  ]);
  return (rgb, p, n, ao) => {
    const part =
        spec.variant === "rack"
          ? rackPartAt(p, spec)
          : spec.variant === "chair"
            ? chairPartAt(p, spec)
            : spec.variant === "trap"
              ? woodenTrapPartAt(p, spec, n)
              : tortureCagePartAt(p),
      d = detailAt(rgb);
    if (part === "wood" || part === "roller") {
      const frame =
        spec.variant === "trap"
          ? trapWoodFrame(p)
          : { axis: part === "roller" ? "y" : "x", centre: [22.5, 0, 32] };
      return {
        ...finishWood(d, p, n, frame.axis, frame.centre, [0.335, 0.275, 0.205]),
        part,
      };
    }
    if (part === "bone") return finishBone(d, p, ao);
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
    const grain = surfaceNoise(...p.map((v) => v * 2.6)),
      wear = clamp((d - 1.02) * 0.25, 0, 0.16);
    return {
      part,
      rgb: [0.31, 0.335, 0.325].map((v, i) =>
        Math.round(
          clamp(
            srgb(
              srgbToLinear(v) * d * (1 - wear) +
                srgbToLinear([0.515, 0.54, 0.52][i]) * wear,
            ),
          ) * 255,
        ),
      ),
      roughness: 0.63 + (grain - 0.5) * 0.1,
      metallic: 0.66,
    };
  };
}
