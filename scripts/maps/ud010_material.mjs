import spec from "./ud010-material.json" with { type: "json" };
import { STONE, srgbToLinear } from "./masonry_palette.mjs";
import { bakedMaterialDetail } from "./material_detail.mjs";
export const DOOR_RECIPE = "ud010-measured-door-v1";
const palette = { stone: STONE, wood: spec.woodColor, iron: spec.ironColor };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const toSrgb = (v) =>
  v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;

function strapDistance(y, z, strap) {
  const [ay, az] = strap.a,
    [by, bz] = strap.b,
    dy = by - ay,
    dz = bz - az;
  const t = clamp(((y - ay) * dy + (z - az) * dz) / (dy * dy + dz * dz), 0, 1);
  return Math.hypot(y - ay - t * dy, z - az - t * dz);
}
export function doorPartAt(x, y, z) {
  const p = spec.portal,
    h = spec.hardware;
  if (
    x < p.minX ||
    x > p.maxX ||
    z < p.bottom ||
    Math.hypot(y, Math.max(0, z - p.spring)) > p.radius
  )
    return "stone";
  if (x <= h.front || x >= h.back) return "iron";
  const ring =
    ((y - spec.ring.center[0]) / spec.ring.radius[0]) ** 2 +
      ((z - spec.ring.center[1]) / spec.ring.radius[1]) ** 2 <
    1;
  const strap = spec.straps.some((s) => strapDistance(y, z, s) < s.radius);
  if ((ring || strap) && (x <= h.bevelFront || x >= h.bevelBack)) return "iron";
  return "wood";
}
export function doorGrain(y, z) {
  const phase = y * 4.4 + 0.23 * Math.sin(z * 0.09);
  let value =
    1 +
    0.065 * Math.sin(phase) +
    0.03 * Math.sin(phase * 3.4) +
    0.035 * Math.sin(y * 0.61 + z * 0.025);
  for (const [cy, cz] of [
    [-1, 60],
    [-7, 39],
    [5.4, 48],
  ]) {
    const r = Math.hypot((y - cy) * 1.3, (z - cz) * 0.48),
      envelope = Math.exp((-r * r) / 8);
    value += envelope * (0.045 * Math.sin(r * 4) - 0.06);
  }
  return clamp(value, 0.77, 1.2);
}
export function paintDoorPixel(rgb, [x, y, z], normal) {
  return paintDoorMaterial(rgb, [x, y, z], normal, doorPartAt(x, y, z));
}
export function paintDoorMaterial(rgb, [x, y, z], normal, part) {
  const detail = bakedMaterialDetail(rgb);
  const grain =
    part === "wood"
      ? doorGrain(y, z)
      : part === "iron"
        ? 1 + 0.045 * Math.sin(y * 0.73 + z * 0.39)
        : 1;
  const color = palette[part].map((v) =>
    Math.round(clamp(toSrgb(srgbToLinear(v) * detail * grain), 0, 1) * 255),
  );
  return {
    part,
    rgb: color,
    roughness:
      part === "wood"
        ? 0.86
        : part === "iron"
          ? clamp(0.65 + 0.06 * Math.sin(y * 0.35 + z * 0.22), 0.57, 0.73)
          : 0.9,
    metallic: part === "iron" ? 0.65 : 0,
  };
}
