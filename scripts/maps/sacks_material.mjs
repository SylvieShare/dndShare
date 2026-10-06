import { pairDetail } from "./raised_material.mjs";
import { paintStone } from "./ultimate_surface.mjs";
import { finishCloth, finishWood } from "./organic_finish.mjs";
import { OLD_STONE, srgbToLinear } from "./masonry_palette.mjs";
const srgb = (v) =>
  v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055;
const ellipse = (x, y, cx, cy, rx, ry) =>
  ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < 1;
export function wallBagsPartAt([x, y, z]) {
  if (z < 14.75 || x > 10.1) return "stone";
  const radius = Math.hypot(x + 0.95, y + 7.1);
  if (z < 24.8 && radius < 8.65 && z > 15.0) {
    if (radius > 6.5 && Math.abs(z - 19.65) < 0.6) return "iron";
    return "wood";
  }
  if (ellipse(x, y, -8.4, 10.6, 4.0, 3.8) && z < 25) return "ceramic";
  if (ellipse(x, y, -7.2, -11.9, 4.1, 4.3) && z < 23.1) return "leather";
  if (ellipse(x, y, 2.2, 6.3, 8.6, 10.4) && z > 16.2) return "sack-back";
  if (ellipse(x, y, -9.5, -3.1, 8.0, 11.0) && z > 15.2) return "sack-front";
  if (z > 16.1 && x < 7.7 && x > -13.8 && Math.abs(y) < 15.2) return "rope";
  return "stone";
}
export function paintWallBags(rgb, p, n) {
  const part = wallBagsPartAt(p),
    d = pairDetail(rgb, [0.57, 0.49, 0.29]);
  if (part === "stone") {
    const original = OLD_STONE.map((v) =>
      Math.round(Math.min(1, srgb(srgbToLinear(v) * d)) * 255),
    );
    return { ...paintStone(original, p, n), part };
  }
  if (part === "wood")
    return finishWood(d, p, n, "z", [-0.95, -7.1, 19], [0.29, 0.25, 0.185]);
  if (part === "sack-back")
    return finishCloth(d, p, n, [0.46, 0.49, 0.36], part);
  if (part === "sack-front")
    return finishCloth(d, p, n, [0.575, 0.5, 0.335], part);
  if (part === "rope") return finishCloth(d, p, n, [0.53, 0.475, 0.33], part);
  const palette = {
    ceramic: [0.415, 0.285, 0.175],
    leather: [0.34, 0.255, 0.165],
    iron: [0.245, 0.26, 0.27],
  };
  return {
    part,
    rgb: palette[part].map((v) =>
      Math.round(Math.min(1, srgb(srgbToLinear(v) * d)) * 255),
    ),
    roughness: part === "iron" ? 0.65 : 0.86,
    metallic: part === "iron" ? 0.55 : 0,
  };
}
export function groundBagsPartAt([x, y, z]) {
  if (z < 14.75) return "stone";
  if (ellipse(x, y, -9.1, 6.7, 3.0, 3.1) && z < 24.0) return "ceramic";
  if (ellipse(x, y, -12.2, 4.9, 3.2, 3.0) && z > 15.0 && z < 21.5)
    return "ceramic";
  if (ellipse(x, y, -8.5, 12.2, 3.2, 3.2) && z < 23.0) return "leather";
  if (ellipse(x, y, 11.7, 1.1, 2.9, 3.1) && z < 25.0) return "ceramic";
  const bag =
    ellipse(x, y, 2.8, 9, 12.5, 9.6) ||
    ellipse(x, y, 8.1, -6.5, 10, 11) ||
    ellipse(x, y, -8.4, -5.5, 9.2, 11.8);
  if (bag && z > 15.2) return "cloth";
  if (x > -11 && x < 12 && Math.abs(y) < 14.8 && z > 15.5) return "rope";
  return "stone";
}
export function paintGroundBags(rgb, p, n) {
  const part = groundBagsPartAt(p),
    d = pairDetail(rgb, [0.57, 0.49, 0.29]);
  if (part === "stone") {
    const original = OLD_STONE.map((v) =>
      Math.round(Math.min(1, srgb(srgbToLinear(v) * d)) * 255),
    );
    return { ...paintStone(original, p, n), part };
  }
  const cloth = {
    "sack-back": [0.59, 0.505, 0.32],
    "sack-front": [0.435, 0.415, 0.315],
    "sack-right": [0.455, 0.505, 0.37],
    rope: [0.54, 0.475, 0.335],
  };
  if (part === "cloth") {
    const smooth = (a, b, v) => {
      const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
      return t * t * (3 - 2 * t);
    };
    const back = smooth(1, 7, p[1]) * smooth(-11, -3, p[0]);
    const right = smooth(-1, 6, p[0]) * (1 - back),
      front = 1 - back - right;
    const tint = [0, 1, 2].map(
      (i) =>
        cloth["sack-back"][i] * back +
        cloth["sack-right"][i] * right +
        cloth["sack-front"][i] * front,
    );
    return finishCloth(d, p, n, tint);
  }
  if (cloth[part]) return finishCloth(d, p, n, cloth[part], part);
  const tint =
    part === "ceramic" ? [0.415, 0.285, 0.175] : [0.34, 0.255, 0.165];
  return {
    part,
    rgb: tint.map((v) =>
      Math.round(Math.min(1, srgb(srgbToLinear(v) * d)) * 255),
    ),
    roughness: 0.88,
    metallic: 0,
  };
}
