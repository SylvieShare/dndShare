import { surfaceNoise } from "./surface_noise.mjs";
export function paintCrystal(p, n, ao, spec) {
  if (!Number.isFinite(ao) || ao < 0 || ao > 255)
    throw new Error("One numeric AO sample required");
  const noise = surfaceNoise(...p.map((v) => v * 0.31));
  const inclusion = surfaceNoise(...p.map((v) => v * 0.11));
  const clean =
    0.82 + 0.18 * Math.max(0, Math.min(1, (ao / 255 - 0.65) / 0.35));
  const strata = 1 + 0.06 * Math.sin(p[2] * 1.7);
  const tint = spec.crystal.tint;
  return {
    part: "crystal",
    rgb: tint.map((v, i) =>
      Math.round(
        255 *
          Math.min(
            1,
            v * (0.85 + 0.26 * noise) * strata * clean +
              [0.1, 0.045, 0.015][i] * Math.max(0, inclusion - 0.52),
          ),
      ),
    ),
    roughness: 0.29 + 0.12 * (1 - noise),
    metallic: 0,
  };
}
