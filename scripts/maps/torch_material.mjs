import { fitBakedMaterials } from "./material_mixture.mjs";
import { finishWood } from "./organic_finish.mjs";
import { paintStone } from "./ultimate_surface.mjs";
import { OLD_STONE, srgbToLinear } from "./masonry_palette.mjs";
import { surfaceNoise } from "./surface_noise.mjs";
import { addedDistance } from "./added_bones.mjs";
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const srgb = (v) =>
  v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055;
const detailAt = fitBakedMaterials([
  OLD_STONE,
  [0.39, 0.22, 0.105],
  [0.34, 0.35, 0.33],
  [0.9, 0.36, 0.055],
]);
export function torchPartAt([x, y, z], spec) {
  if (spec.variant === "basic") {
    const radius = Math.hypot(x - 7.75, y);
    if (
      (spec.lit && z > 40.55 && radius < 2.85) ||
      (spec.lit && z > 41.8 && x < 10.05 && Math.abs(y) < 3.1 && x > 4.8)
    )
      return "flame";
    if (z > 33.75 && z < 41.85 && x > 4.1 && x < 10.1 && Math.abs(y) < 4.35)
      return "iron";
    if (z > 29.3 && z < 34.2 && Math.hypot(x - 9.75, y) < 1.38) return "wood";
    return "stone";
  }
  if (spec.variant === "niche") {
    const radius = Math.hypot(x - 11.7, y);
    if (
      !spec.lit &&
      z > 31.1 &&
      z < 35.5 &&
      ((x - 12.5) / 2.35) ** 2 + ((y - 0.8) / 2.85) ** 2 < 1
    )
      return z > 32.4 ? "charcoal" : "ash";
    if (
      spec.lit &&
      z > 32.25 &&
      z < 40.4 &&
      ((x - 11.7) / 2.85) ** 2 + (y / 2.7) ** 2 < 1
    )
      return "flame";
    if (
      z > 25.5 &&
      z < 34.2 &&
      x > 7.15 &&
      x < 15.9 &&
      Math.abs(y) < 4.1 &&
      radius < 4.65
    )
      return "iron";
    if (z > 18.5 && z < 25.6 && Math.hypot(x - 13.1, y) < 2.5) return "wood";
    return "stone";
  }
  throw new Error("Unmeasured torch variant");
}
export function makeTorchPainter(spec, bare) {
  return (rgb, p, n) => {
    let part = torchPartAt(p, spec);
    if (part === "flame" && bare && addedDistance(p, bare) < 0.35)
      part = p[2] < 33.5 ? "iron" : "stone";
    const d = detailAt(rgb);
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
    if (part === "wood")
      return finishWood(
        d,
        p,
        n,
        "z",
        [spec.variant === "basic" ? 9.75 : 13.1, 0, 31],
        [0.245, 0.205, 0.145],
      );
    let tint,
      roughness = 0.64,
      metallic = 0.68;
    if (part === "charcoal" || part === "ash") {
      const dust = surfaceNoise(...p.map((v) => v * 0.9));
      tint = part === "charcoal" ? [0.115, 0.125, 0.12] : [0.385, 0.38, 0.335];
      return {
        part,
        rgb: tint.map((v) =>
          Math.round(
            clamp(srgb(srgbToLinear(v) * d * (0.92 + dust * 0.16))) * 255,
          ),
        ),
        roughness: 0.97,
        metallic: 0,
      };
    }
    if (part === "flame") {
      const height = clamp(
          (p[2] - (spec.variant === "basic" ? 40.9 : 32.45)) / 5.7,
        ),
        curl = surfaceNoise(p[0] * 0.65, p[1] * 0.65, p[2] * 0.35);
      const t = clamp(height + (curl - 0.5) * 0.23);
      tint = [1, 0.87, 0.24].map(
        (v, i) => v * (1 - t) + [0.89, 0.21, 0.055][i] * t,
      );
      return {
        part,
        rgb: tint.map((v) =>
          Math.round(clamp(srgb(srgbToLinear(v) * clamp(d, 0.88, 1.1))) * 255),
        ),
        roughness: 0.76,
        metallic: 0,
      };
    }
    const grain = surfaceNoise(...p.map((v) => v * 2.1));
    const wear = clamp((d - 1.04) * 0.27, 0, 0.17);
    const soot =
      spec.lit && p[2] > (spec.variant === "basic" ? 39 : 31.5) ? 0.18 : 0.02;
    tint = [0.255, 0.275, 0.285].map(
      (v, i) =>
        srgbToLinear(v) * d * (1 - soot) * (1 - wear) +
        srgbToLinear([0.46, 0.48, 0.485][i]) * wear,
    );
    return {
      part,
      rgb: tint.map((v) => Math.round(clamp(srgb(v)) * 255)),
      roughness: roughness + (grain - 0.5) * 0.1,
      metallic,
    };
  };
}
