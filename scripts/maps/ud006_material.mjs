import spec from "./ud006-material.json" with { type: "json" };
import { STONE, srgbToLinear } from "./masonry_palette.mjs";
export const TIMBER_RECIPE = "ud006-measured-timber-v1";
export const WOOD_COLOR = spec.woodColor;
const oldWood = [0.39, 0.22, 0.105].map(srgbToLinear);
const stone = STONE.map(srgbToLinear),
  wood = WOOD_COLOR.map(srgbToLinear);
const toSrgb = (v) =>
  v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const normalized = (v) => v.map((x) => x / Math.max(...v));
const oldChroma = normalized(oldWood),
  stoneChroma = normalized(stone);

export function timberPartAt(x, y, z) {
  for (const name of ["post", "brace", "foot"]) {
    const region = spec[name],
      p = [x, y, z];
    if (!p.every((v, i) => v >= region.min[i] && v <= region.max[i])) continue;
    return name;
  }
  return "stone";
}

export function timberGrain(part, [x, y, z], [nx, ny, nz]) {
  let across, along, endRadius, isEnd;
  if (part === "post") {
    across = Math.abs(ny) > Math.abs(nx) ? x - 13.8 : y - 14.1;
    along = z;
    isEnd = nz > 0.7 && z > 47.5;
    endRadius = Math.hypot(x - 13.8, y - 14.1);
  } else if (part === "brace") {
    across = Math.abs(ny) > 0.5 ? (z - x - 14.7) / Math.SQRT2 : y - 14.2;
    along = (x + z) / Math.SQRT2;
    isEnd = Math.abs((nx + nz) / Math.SQRT2) > 0.8;
    endRadius = Math.hypot((z - x - 14.7) / Math.SQRT2, y - 14.2);
  } else {
    across = Math.abs(nz) > 0.5 ? y - 14.3 : z - 16.1;
    along = x;
    isEnd = Math.abs(nx) > 0.8;
    endRadius = Math.hypot(y - 14.3, z - 16.1);
  }
  const phase = isEnd
    ? endRadius * 4.5
    : across * 5 + 0.22 * Math.sin(along * 0.12);
  let variation =
    1 +
    0.07 * Math.sin(phase) +
    0.035 * Math.sin(phase * 3.1) +
    0.025 * Math.sin(along * 0.045 + across * 0.4);
  if (part === "post" && ny < -0.5) {
    for (const [cx, cz] of [
      [13.7, 42.9],
      [14.1, 21.2],
    ]) {
      const radius = Math.hypot((x - cx) * 1.3, (z - cz) * 0.5),
        envelope = Math.exp((-radius * radius) / 9);
      variation += envelope * (0.06 * Math.sin(radius * 4) - 0.08);
    }
  }
  return clamp(variation, 0.76, 1.22);
}

export function paintTimberPixel(rgb, position, normal) {
  const part = timberPartAt(...position),
    linear = rgb.map((v) => srgbToLinear(v / 255));
  const chroma = normalized(linear);
  const oldDistance = Math.hypot(...chroma.map((v, i) => v - oldChroma[i]));
  const stoneDistance = Math.hypot(...chroma.map((v, i) => v - stoneChroma[i]));
  const wasWood = oldDistance < stoneDistance;
  if (part === "stone" && !wasWood) return { rgb, roughness: null, part };
  const previous = wasWood ? oldWood : stone;
  const ratios = linear.map((v, i) => v / previous[i]).sort((a, b) => a - b);
  const detail = clamp(ratios[1], 0.38, 1.45);
  const target = part === "stone" ? stone : wood;
  const grain = part === "stone" ? 1 : timberGrain(part, position, normal);
  return {
    rgb: target.map((v) =>
      Math.round(clamp(toSrgb(v * detail * grain), 0, 1) * 255),
    ),
    roughness:
      part === "stone"
        ? 0.9
        : clamp(0.87 + 0.025 * Math.sin(position[2] * 0.18), 0.82, 0.91),
    part,
  };
}
