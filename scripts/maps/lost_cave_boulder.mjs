import { surfaceNoise } from "./surface_noise.mjs";
const clamp = (v) => Math.max(0, Math.min(1, v));
export function paintBoulder(p, n, ao, spec) {
  if (!Number.isFinite(ao)) throw new Error("One numeric AO sample required");
  const broad = surfaceNoise(...p.map((v) => v * 0.1));
  const grain = surfaceNoise(...p.map((v) => v * 2.6));
  const mineral = clamp((surfaceNoise(...p.map((v) => v * 0.34)) - 0.57) * 2.4);
  const recess = 0.68 + 0.32 * clamp((ao / 255 - 0.65) / 0.35);
  const dust = Math.max(0, n[2]) * 0.035;
  return {
    part: "boulder",
    rgb: spec.boulder.tint.map((v, i) =>
      Math.round(
        255 *
          clamp(
            (v * (0.84 + 0.3 * broad + 0.06 * grain) +
              [0.035, 0.03, 0.02][i] * mineral +
              dust) *
              recess,
          ),
      ),
    ),
    roughness: 0.85 + grain * 0.1,
    metallic: 0,
  };
}
