// Compare ornament to the measured bare floor, including low bone edges.
import { OLD_STONE, srgbToLinear } from "./masonry_palette.mjs";
import { paintStone } from "./ultimate_surface.mjs";
import { surfaceNoise } from "./surface_noise.mjs";
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const dot = (a, b) => a.reduce((n, v, i) => n + v * b[i], 0);
const linear = Array.from({ length: 256 }, (_, i) => srgbToLinear(i / 255));
const toSrgb = (v) =>
  v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055;
export function pairDetail(rgb, palette) {
  const a = OLD_STONE.map(srgbToLinear),
    b = palette.map(srgbToLinear),
    c = rgb.map((v) => linear[v]);
  const aa = dot(a, a),
    ab = dot(a, b),
    bb = dot(b, b),
    den = aa * bb - ab * ab;
  const ac = dot(a, c),
    bc = dot(b, c),
    wa = (bb * ac - ab * bc) / den,
    wb = (aa * bc - ab * ac) / den;
  const fits = [
    [ac / aa, 0],
    [0, bc / bb],
  ];
  if (wa >= 0 && wb >= 0) fits.push([wa, wb]);
  let error = Infinity,
    detail = 1;
  for (const [x, y] of fits) {
    const distance =
      c.reduce((n, v, i) => n + (v - x * a[i] - y * b[i]) ** 2, 0) +
      (x > 0.003 && y > 0.003 ? 0.00001 : 0);
    if (distance < error) {
      error = distance;
      detail = x + y;
    }
  }
  return clamp(detail, 0.38, 1.45);
}
export function sampleHeight(reference, x, y) {
  const gx = clamp((x - reference.min) / reference.step, 0, reference.size - 1),
    gy = clamp((y - reference.min) / reference.step, 0, reference.size - 1);
  const ix = Math.floor(gx),
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
}
export function makeRaisedPainter(reference, spec) {
  return (rgb, point, normal) => {
    const [x, y, z] = point;
    const height = spec.floorHeight ?? sampleHeight(reference, x, y);
    const floorOrnament =
      x < (spec.wallFront ?? 9.9) &&
      (!spec.corner || y < 9.9) &&
      z > height + 0.22;
    const sillOrnament =
      spec.sillBones &&
      x > 10 &&
      x < 16.6 &&
      Math.abs(y) < 7.35 &&
      z > 31.25 &&
      z < 36.1;
    const ornament = floorOrnament || sillOrnament;
    const detail = pairDetail(rgb, [0.79, 0.72, 0.52]);
    // Reconstruct the old bake's illumination-independent grain for both materials.
    if (!ornament) {
      const stoneRgb = OLD_STONE.map((v) =>
        Math.round(clamp(toSrgb(srgbToLinear(v) * detail)) * 255),
      );
      return { ...paintStone(stoneRgb, point, normal), part: "stone" };
    }
    const age = 1 + (surfaceNoise(x * 0.3, y * 0.3, z * 0.3) - 0.5) * 0.09;
    const grain = 1 + (surfaceNoise(x * 4, y * 4, z * 4) - 0.5) * 0.07;
    return {
      part: "bone",
      rgb: [0.735, 0.685, 0.55].map((v) =>
        Math.round(clamp(toSrgb(srgbToLinear(v) * detail * age * grain)) * 255),
      ),
      roughness: 0.84,
      metallic: 0,
    };
  };
}
