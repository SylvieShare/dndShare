import { OLD_STONE, srgbToLinear } from "./masonry_palette.mjs";
export const DEBRIS_RECIPE = "ud009-layered-stone-v1";
const old = OLD_STONE.map(srgbToLinear);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (a, b, v) => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const toSrgb = (v) =>
  v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055;
const palette = {
  base: [0.29, 0.32, 0.335],
  floor: [0.34, 0.37, 0.385],
  wall: [0.335, 0.37, 0.39],
  rubble: [0.39, 0.415, 0.43],
};

const hash = (x, y, z) => {
  const n = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return n - Math.floor(n);
};
function noise(x, y, z) {
  const ix = Math.floor(x),
    iy = Math.floor(y),
    iz = Math.floor(z),
    tx = smooth(0, 1, x - ix),
    ty = smooth(0, 1, y - iy),
    tz = smooth(0, 1, z - iz);
  let value = 0;
  for (let dx = 0; dx < 2; dx++)
    for (let dy = 0; dy < 2; dy++)
      for (let dz = 0; dz < 2; dz++)
        value +=
          hash(ix + dx, iy + dy, iz + dz) *
          (dx ? tx : 1 - tx) *
          (dy ? ty : 1 - ty) *
          (dz ? tz : 1 - tz);
  return value;
}
export function debrisPartAt(x, y, z) {
  if (z < 13.35) return "base";
  if (z < 16.1) return "floor";
  if (x > 10.7 && z < 38.6) return "wall";
  return "rubble";
}
export function paintDebrisPixel(rgb, [x, y, z], [nx, ny, nz]) {
  const part = debrisPartAt(x, y, z);
  const ratios = rgb
    .map((v, i) => srgbToLinear(v / 255) / old[i])
    .sort((a, b) => a - b);
  const detail = clamp(0.9 + (ratios[1] - 0.9) * 1.28, 0.4, 1.42);
  const broad = noise(x * 0.12, y * 0.12, z * 0.12),
    fine = noise(x * 2.8, y * 2.8, z * 2.8),
    micro = noise(x * 6.1, y * 6.1, z * 6.1);
  const grain = 1 + (fine - 0.5) * 0.2 + (micro - 0.5) * 0.09;
  const variation = 1 + (broad - 0.5) * (part === "rubble" ? 0.16 : 0.07);
  const dust =
    part === "rubble"
      ? smooth(0.3, 0.9, nz) * 0.06
      : part === "floor"
        ? smooth(0.5, 0.95, nz) * 0.025
        : 0;
  const edge = part === "rubble" ? smooth(1.05, 1.4, detail) * 0.035 : 0;
  const color = palette[part].map((v) => {
    const stone = srgbToLinear(v) * detail * grain * variation;
    const clean = srgbToLinear(0.47) * (dust + edge);
    return Math.round(
      clamp(toSrgb(stone * (1 - dust - edge) + clean), 0, 1) * 255,
    );
  });
  return {
    part,
    rgb: color,
    roughness: clamp(
      (part === "rubble" ? 0.91 : part === "base" ? 0.94 : 0.87) +
        (fine - 0.5) * 0.06 +
        dust * 0.25,
      0.82,
      0.97,
    ),
  };
}
