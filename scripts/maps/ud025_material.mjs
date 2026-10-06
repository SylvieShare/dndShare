// Bone-covered stone pedestal, with four independent hanging iron chains.
import { pairDetail } from "./raised_material.mjs";
import { paintStone } from "./ultimate_surface.mjs";
import { finishBone } from "./bone_finish.mjs";
import { OLD_STONE, srgbToLinear } from "./masonry_palette.mjs";
import { surfaceNoise } from "./surface_noise.mjs";
import boneCentres from "./ud025-bone-centres.json" with { type: "json" };
const srgb = (v) =>
  v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055;
const clamp = (v) => Math.max(0, Math.min(1, v));
const distance2D = (p, a, b) => {
  const dx = b[0] - a[0],
    dy = b[1] - a[1],
    t = clamp(((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy));
  return Math.hypot(p[0] - a[0] - dx * t, p[1] - a[1] - dy * t);
};
export function pedestalPartAt([x, y, z]) {
  if (z > 39.92) return "bone";
  const femurs = [
    { a: [-13.65, 4.5], b: [-13.45, -6.6], z: [17.4, 20.4] },
    { a: [-8.3, 14.55], b: [4.5, 14.45], z: [17.5, 20.5] },
  ];
  if (
    femurs.some(
      (f) => z > f.z[0] && z < f.z[1] && distance2D([x, y], f.a, f.b) < 1.2,
    )
  )
    return "bone";
  const corners = [
    [-12.1, -6.0],
    [-10.6, 9.9],
    [5.3, -9.1],
    [7.3, 9.1],
  ];
  const outside = x < -10.3 || x > 6.8 || y < -8.2 || y > 10.3;
  if (
    z > 20 &&
    z < 39.05 &&
    outside &&
    corners.some(([cx, cy]) => Math.hypot(x - cx, y - cy) < 1.9)
  )
    return "iron";
  return "stone";
}
export function paintPedestal(rgb, p, n, ao) {
  const part = pedestalPartAt(p),
    detail = pairDetail(rgb, [0.79, 0.72, 0.52]);
  if (part === "bone")
    return finishBone(detail, p, ao, p[2] > 39.92 ? boneCentres : undefined);
  if (part === "stone") {
    const original = OLD_STONE.map((v) =>
      Math.round(clamp(srgb(srgbToLinear(v) * detail)) * 255),
    );
    return { ...paintStone(original, p, n), part: "stone" };
  }
  const grain = surfaceNoise(...p.map((v) => v * 3));
  return {
    part,
    rgb: [0.26, 0.275, 0.285].map((v) =>
      Math.round(
        clamp(srgb(srgbToLinear(v) * detail * (1 + (grain - 0.5) * 0.12))) *
          255,
      ),
    ),
    roughness: 0.64 + (grain - 0.5) * 0.08,
    metallic: 0.55,
  };
}
