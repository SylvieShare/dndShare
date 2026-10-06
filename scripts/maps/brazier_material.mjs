import { fitBakedMaterials } from "./material_mixture.mjs";
import { paintStone } from "./ultimate_surface.mjs";
import { OLD_STONE, srgbToLinear } from "./masonry_palette.mjs";
import { surfaceNoise } from "./surface_noise.mjs";
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const srgb = (v) =>
  v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055;
const detailAt = fitBakedMaterials([OLD_STONE, [0.34, 0.35, 0.33]]);
export function brazierPartAt([x, y, z]) {
  const radius = Math.hypot(x, y);
  if (radius < 9.2 && z > 17.5 && z < 28.4) return "charcoal";
  if (
    (z > 19 && radius < 16.8) ||
    (z > 15.5 && radius > 9.0 && radius < 11.4) ||
    (z > 14.85 && radius > 10.65 && radius < 12.1)
  )
    return "iron";
  return "stone";
}
export function paintBrazier(rgb, p, n) {
  const part = brazierPartAt(p),
    d = detailAt(rgb);
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
  const grain = surfaceNoise(...p.map((v) => v * 1.8));
  if (part === "charcoal") {
    const dust =
      clamp((surfaceNoise(...p.map((v) => v * 0.42)) - 0.38) * 0.55) *
      Math.max(0.2, n[2]);
    return {
      part,
      rgb: [0.12, 0.13, 0.125].map((v, i) =>
        Math.round(
          clamp(
            srgb(
              srgbToLinear(v) * d * (1 - dust) +
                srgbToLinear([0.36, 0.365, 0.33][i]) * dust,
            ),
          ) * 255,
        ),
      ),
      roughness: 0.97,
      metallic: 0,
    };
  }
  const wear = clamp((d - 1.03) * 0.25, 0, 0.16);
  const rust = clamp(
    (surfaceNoise(...p.map((v) => v * 0.25)) - 0.65) * 0.13,
    0,
    0.04,
  );
  return {
    part,
    rgb: [0.305, 0.325, 0.335].map((v, i) =>
      Math.round(
        clamp(
          srgb(
            srgbToLinear(v) * d * (1 - wear - rust) +
              srgbToLinear([0.52, 0.54, 0.545][i]) * wear +
              srgbToLinear([0.33, 0.22, 0.14][i]) * rust,
          ),
        ) * 255,
      ),
    ),
    roughness: 0.65 + (grain - 0.5) * 0.12,
    metallic: 0.65,
  };
}
