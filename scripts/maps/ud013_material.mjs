import { OLD_STONE, srgbToLinear } from "./masonry_palette.mjs";
import { finishBone } from "./bone_finish.mjs";
import { addedWallSurface } from "./wall_added_surface.mjs";
import boneCentres from "./ud013-bone-centres.json" with { type: "json" };
export const SKULL_RECIPE = "ud013-aged-ivory-v2";
const stone = OLD_STONE.map(srgbToLinear),
  bone = [0.79, 0.72, 0.52].map(srgbToLinear);
const dot = (a, b) => a.reduce((n, v, i) => n + v * b[i], 0);
const ss = dot(stone, stone),
  sb = dot(stone, bone),
  bb = dot(bone, bone),
  den = ss * bb - sb * sb;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const toSrgb = (v) =>
  v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055;
const palettes = { stone: [0.335, 0.37, 0.39], bone: [0.735, 0.685, 0.55] };
const lut = Array.from({ length: 256 }, (_, i) => srgbToLinear(i / 255));
function detail(rgb) {
  const c = rgb.map((v) => lut[v]),
    s = dot(c, stone),
    b = dot(c, bone);
  const a = (bb * s - sb * b) / den,
    d = (ss * b - sb * s) / den;
  const candidates = [{ weights: [s / ss, 0] }, { weights: [0, b / bb] }];
  if (a >= 0 && d >= 0) candidates.push({ weights: [a, d] });
  let best = Infinity,
    value = 1;
  for (const candidate of candidates) {
    const [ws, wb] = candidate.weights;
    const error =
      c.reduce((n, v, i) => n + (v - ws * stone[i] - wb * bone[i]) ** 2, 0) +
      (ws > 0.003 && wb > 0.003 ? 0.00001 : 0);
    if (error < best) {
      best = error;
      value = ws + wb;
    }
  }
  return clamp(value, 0.38, 1.45);
}
export function skullPartAt(x, y, z, floorHeight = 13.7) {
  if (x >= 9.9 || y >= 9.9 || z < 13.6) return "stone";
  return z > floorHeight + 0.42 ? "bone" : "stone";
}
export function makeSkullPainter(reference, wallReference) {
  const floorHeight = (x, y) => {
    const gx = clamp(
        (x - reference.min) / reference.step,
        0,
        reference.size - 1,
      ),
      gy = clamp((y - reference.min) / reference.step, 0, reference.size - 1),
      ix = Math.floor(gx),
      iy = Math.floor(gy),
      jx = Math.min(ix + 1, reference.size - 1),
      jy = Math.min(iy + 1, reference.size - 1),
      tx = gx - ix,
      ty = gy - iy;
    const at = (xx, yy) => reference.heights[yy * reference.size + xx];
    return (
      at(ix, iy) * (1 - tx) * (1 - ty) +
      at(jx, iy) * tx * (1 - ty) +
      at(ix, jy) * (1 - tx) * ty +
      at(jx, jy) * tx * ty
    );
  };
  return (rgb, [x, y, z], normal, ao) => {
    const part = addedWallSurface([x, y, z], wallReference)
        ? "bone"
        : skullPartAt(x, y, z, floorHeight(x, y)),
      d = detail(rgb),
      variation =
        1 +
        0.035 * Math.sin(x * 0.61 + y * 0.37 + z * 0.11) +
        0.018 * Math.sin(x * 2.7 - y * 1.9 + z * 0.8);
    if (part === "bone") return finishBone(d, [x, y, z], ao, boneCentres);
    const aged =
      part === "bone" ? 1 - 0.035 * Math.sin(x * 0.16 + y * 0.2) ** 2 : 1;
    return {
      part,
      rgb: palettes[part].map((v) =>
        Math.round(
          clamp(toSrgb(srgbToLinear(v) * d * variation * aged), 0, 1) * 255,
        ),
      ),
      roughness: part === "bone" ? 0.83 : 0.9,
    };
  };
}
