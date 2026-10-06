// Dark mortar follows the recessed stone surface, rather than a painted grid.
import { srgbToLinear } from "./masonry_palette.mjs";
const clamp = (v) => Math.max(0, Math.min(1, v));
const smooth = (a, b, v) => {
  const t = clamp((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const linear = Array.from({ length: 256 }, (_, i) => srgbToLinear(i / 255));
const toSrgb = (v) =>
  v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055;
export function floorJointWeight(
  rgb,
  [x, y, z],
  [nx, ny, nz],
  cutHeight = 11.5,
  bounds = [17.5, 17.5],
  ao = 255,
) {
  const lo = Math.min(...rgb),
    hi = Math.max(...rgb);
  if (!hi || (hi - lo) / hi > 0.27 || rgb[2] < rgb[0] * 0.98) return 0;
  // The thin ground tiles use the same upper stone course with a shorter crop.
  const offset = cutHeight === 4.6 ? 0.12 : 0;
  if (Math.abs(x) > bounds[0] - 0.65 || Math.abs(y) > bounds[1] - 0.65)
    return 0;
  const band =
    smooth(12.85 + offset, 13.12 + offset, z) *
    (1 - smooth(13.5 + offset, 14.18 + offset, z));
  const exposed = smooth(-0.15, 0.45, nz);
  const recessed = (1 - smooth(0.78, 0.95, ao / 255)) * smooth(0.35, 0.8, nz);
  return Math.max(band * exposed, recessed);
}
export function paintFloorJoint(
  rgb,
  point,
  normal,
  cutHeight = 11.5,
  bounds = [17.5, 17.5],
  ao = 255,
) {
  const weight = floorJointWeight(rgb, point, normal, cutHeight, bounds, ao);
  const factor = 1 - 0.66 * weight;
  return {
    part: weight > 0.02 ? "joint" : "unchanged",
    rgb: rgb.map((v) => Math.round(toSrgb(linear[v] * factor) * 255)),
    roughness: 0.9,
    metallic: 0,
  };
}
