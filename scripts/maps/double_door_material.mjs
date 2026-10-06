import { fitBakedMaterials } from "./material_mixture.mjs";
import { paintStone } from "./ultimate_surface.mjs";
import { finishBone } from "./bone_finish.mjs";
import { finishWood } from "./organic_finish.mjs";
import { sampleHeight } from "./raised_material.mjs";
import { OLD_STONE, srgbToLinear } from "./masonry_palette.mjs";
import { surfaceNoise } from "./surface_noise.mjs";
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const srgb = (v) =>
  v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055;
function nearChain(p, path) {
  return path.slice(1).some((b, i) => {
    const a = path[i],
      d = b.map((v, j) => v - a[j]);
    const t = clamp(
      d.reduce((sum, v, j) => sum + v * (p[j] - a[j]), 0) /
        d.reduce((sum, v) => sum + v * v, 0),
    );
    return Math.hypot(...p.map((v, j) => v - a[j] - t * d[j])) < 1.7;
  });
}
export function doubleDoorPartAt(p, spec, floor) {
  const [x, y, z] = p,
    h = spec.head;
  if (
    x < 11.08 &&
    y > -13.6 &&
    y < 3.3 &&
    p.reduce((sum, v, i) => sum + ((v - h.centre[i]) / h.radius[i]) ** 2, 0) <
      1.05
  )
    return "bone";
  if (z > sampleHeight(floor, x, y) + 0.2 && nearChain(p, spec.chain))
    return "iron";
  const handle =
    x < 10.95 && x > 7.5 && y > -16.2 && y < -10.5 && z > 32 && z < 38.4;
  if (handle) return "iron";
  const collar =
    (x < 10.4 || x > 15.3) &&
    y > 12.5 &&
    y < 18.5 &&
    ((z > 16 && z < 25.5) || (z > 27.5 && z < 40.5));
  if (collar) return "iron";
  const collarFront =
    x > 9 &&
    x < 16 &&
    y > 16.9 &&
    y < 18.5 &&
    ((z > 17.8 && z < 25.3) || (z > 31 && z < 39));
  if (collarFront) return "iron";
  if (z < 15.1 || x < 9.2 || x > 16.9) return "stone";
  const radius = Math.hypot(y + 17.5, z - 41.5);
  const inner = Math.abs(y) < 14 && z > 18.2 && (z < 42 || radius < 31.3);
  if (inner && (x < 11.06 || x > 14.35)) return "iron";
  if (
    y < -14.25 ||
    (y > 13.5 && z < 42) ||
    z < 18.2 ||
    (z >= 42 && radius > 31.3)
  )
    return "frame";
  return "wood";
}
export function doorWoodFrame(p, n) {
  const [x, y, z] = p;
  if (z < 18.2) return { p, n, axis: "y" };
  if (z > 42 && Math.hypot(y + 17.5, z - 41.5) > 31.3) {
    const angle = Math.atan2(z - 41.5, y + 17.5),
      c = Math.cos(angle),
      s = Math.sin(angle);
    return {
      p: [x, Math.hypot(y + 17.5, z - 41.5) - 33, angle * 33],
      n: [n[0], n[1] * c + n[2] * s, -n[1] * s + n[2] * c],
      axis: "z",
    };
  }
  return { p, n, axis: "z" };
}
export function makeDoubleDoorPainter(spec, floor) {
  const detailAt = fitBakedMaterials([
    OLD_STONE,
    [0.39, 0.22, 0.105],
    [0.34, 0.35, 0.33],
    [0.79, 0.72, 0.52],
  ]);
  return (rgb, point, normal, ao) => {
    const sign = spec.mirror ? -1 : 1,
      p = [point[0], point[1] * sign, point[2]],
      n = [normal[0], normal[1] * sign, normal[2]];
    const part = doubleDoorPartAt(p, spec, floor),
      d = detailAt(rgb);
    if (part === "bone") return finishBone(d, p, ao);
    if (part === "stone")
      return {
        ...paintStone(
          OLD_STONE.map((v) =>
            Math.round(clamp(srgb(srgbToLinear(v) * d)) * 255),
          ),
          point,
          normal,
        ),
        part,
      };
    if (part === "wood" || part === "frame") {
      const frame =
        part === "frame" ? doorWoodFrame(p, n) : { p, n, axis: "z" };
      return {
        ...finishWood(
          d,
          frame.p,
          frame.n,
          frame.axis,
          [12, 0, 0],
          part === "frame" ? [0.35, 0.285, 0.21] : [0.31, 0.255, 0.185],
        ),
        part,
      };
    }
    const grain = surfaceNoise(...p.map((v) => v * 2.5)),
      wear = clamp((d - 1.02) * 0.25, 0, 0.13);
    return {
      part,
      rgb: [0.315, 0.345, 0.33].map((v, i) =>
        Math.round(
          clamp(
            srgb(
              srgbToLinear(v) * d * (1 - wear) +
                srgbToLinear([0.52, 0.545, 0.52][i]) * wear,
            ),
          ) * 255,
        ),
      ),
      roughness: 0.63 + (grain - 0.5) * 0.1,
      metallic: 0.68,
    };
  };
}
