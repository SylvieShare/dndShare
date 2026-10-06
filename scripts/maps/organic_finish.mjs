import { srgbToLinear } from "./masonry_palette.mjs";
import { surfaceNoise } from "./surface_noise.mjs";
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const srgb = (v) =>
  v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055;
export function finishWood(
  detail,
  p,
  n,
  axis = "x",
  centre = [0, 0, 0],
  tint = [0.32, 0.275, 0.205],
) {
  const a = { x: 0, y: 1, z: 2 }[axis],
    other = [0, 1, 2].filter((i) => i !== a);
  const acrossIndex =
    Math.abs(n[other[0]]) > Math.abs(n[other[1]]) ? other[1] : other[0];
  const along = p[a] - centre[a],
    across = p[acrossIndex] - centre[acrossIndex];
  const end = Math.abs(n[a]) > 0.8;
  const radius = Math.hypot(...other.map((i) => p[i] - centre[i]));
  const phase = end
    ? radius * 4.7
    : across * 5.8 + 0.22 * Math.sin(along * 0.12);
  const grain =
    1 +
    0.08 * Math.sin(phase) +
    0.026 * Math.sin(phase * 3.3) +
    (surfaceNoise(...p.map((v) => v * 0.45)) - 0.5) * 0.055;
  const wear = clamp((detail - 1.05) * 0.24, 0, 0.12);
  return {
    part: "wood",
    rgb: tint.map((v) =>
      Math.round(
        clamp(
          srgb(
            srgbToLinear(v) * detail * grain * (1 - wear) +
              srgbToLinear(0.49) * wear,
          ),
        ) * 255,
      ),
    ),
    roughness: 0.86,
    metallic: 0,
  };
}
export function finishCloth(
  detail,
  p,
  n,
  tint = [0.58, 0.55, 0.435],
  part = "cloth",
) {
  const dominant = n.map(Math.abs).indexOf(Math.max(...n.map(Math.abs))),
    axes = [0, 1, 2].filter((i) => i !== dominant);
  const weave =
    1 + 0.018 * Math.sin(p[axes[0]] * 37) + 0.018 * Math.sin(p[axes[1]] * 41);
  const age = 1 + (surfaceNoise(...p.map((v) => v * 0.22)) - 0.5) * 0.12;
  return {
    part,
    rgb: tint.map((v) =>
      Math.round(clamp(srgb(srgbToLinear(v) * detail * weave * age)) * 255),
    ),
    roughness: 0.94,
    metallic: 0,
  };
}
