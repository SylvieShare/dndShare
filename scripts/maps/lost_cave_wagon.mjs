import { surfaceNoise } from "./surface_noise.mjs";
const clamp = (v) => Math.max(0, Math.min(1, v));
export function wagonPartAt([x, y, z], spec) {
  if (
    Math.abs(y - spec.wagon.brass.y) < 1.5 &&
    Math.hypot(x - spec.wagon.brass.x, z - spec.wagon.brass.z) <
      spec.wagon.brass.radius
  )
    return "brass";
  if (
    (Math.abs(x - spec.wagon.pipe.x) < 1.25 && y > 15.1 && z > 4 && z < 36) ||
    (x > -10.8 && x < 5 && Math.hypot(y - 13.55, z - 3.35) < 2.5)
  )
    return "hardware";
  if (
    Math.abs(x) > 8.4 &&
    Math.abs(x) < 13.6 &&
    spec.wagon.wheelsY.some((c) => Math.hypot(y - c, z - 4.3) < 4.3)
  )
    return "wheel";
  return "bucket";
}
export function paintWagon(p, n, ao, spec) {
  if (!Number.isFinite(ao)) throw new Error("One numeric AO sample required");
  const part = wagonPartAt(p, spec),
    grain = surfaceNoise(...p.map((v) => v * 0.6));
  const rust = clamp((surfaceNoise(...p.map((v) => v * 0.18)) - 0.35) * 2.1);
  const detail = 0.72 + 0.28 * clamp((ao / 255 - 0.65) / 0.35);
  const tint =
    part === "brass"
      ? [0.58, 0.44, 0.16]
      : part === "hardware"
        ? [0.3, 0.32, 0.32]
        : part === "wheel"
          ? [0.25, 0.2, 0.125]
          : spec.wagon.tint;
  const amount =
    part === "brass" ? 0.12 : part === "hardware" ? 0.18 : rust * 0.65;
  const clean =
    clamp((p[2] - 33.8) / 2.2) *
    Math.max(0, n[2]) *
    (part === "bucket" ? 0.065 : 0);
  return {
    part,
    rgb: tint.map((v, i) =>
      Math.round(
        255 *
          clamp(
            ((v * (1 - amount) + [0.36, 0.145, 0.055][i] * amount) *
              (0.9 + 0.2 * grain) +
              clean) *
              detail,
          ),
      ),
    ),
    roughness:
      part === "brass"
        ? 0.36
        : part === "hardware"
          ? 0.48
          : 0.58 + amount * 0.33 - clean,
    metallic:
      part === "brass"
        ? 0.9
        : part === "hardware"
          ? 0.86
          : 0.74 * (1 - amount * 0.75),
  };
}
