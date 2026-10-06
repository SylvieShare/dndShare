// Recover baked surface detail from a small known set of source pigments.
import { srgbToLinear } from "./masonry_palette.mjs";
const dot = (a, b) => a.reduce((sum, v, i) => sum + v * b[i], 0);
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const lut = Array.from({ length: 256 }, (_, i) => srgbToLinear(i / 255));
export function fitBakedMaterials(pigments) {
  const bases = pigments.map((p) => p.map(srgbToLinear)),
    fits = [];
  for (let i = 0; i < bases.length; i++) {
    const a = bases[i];
    fits.push({ ids: [i], rows: [a.map((v) => v / dot(a, a))] });
    for (let j = i + 1; j < bases.length; j++) {
      const b = bases[j],
        aa = dot(a, a),
        ab = dot(a, b),
        bb = dot(b, b),
        den = aa * bb - ab * ab;
      if (Math.abs(den) > 1e-12)
        fits.push({
          ids: [i, j],
          rows: [
            a.map((v, c) => (bb * v - ab * b[c]) / den),
            b.map((v, c) => (aa * v - ab * a[c]) / den),
          ],
        });
      for (let k = j + 1; k < bases.length; k++) {
        const c = bases[k],
          det = dot(a, cross(b, c));
        if (Math.abs(det) > 1e-9)
          fits.push({
            ids: [i, j, k],
            rows: [cross(b, c), cross(c, a), cross(a, b)].map((row) =>
              row.map((v) => v / det),
            ),
          });
      }
    }
  }
  const cache = new Map();
  return (rgb) => {
    const key = (rgb[0] << 16) | (rgb[1] << 8) | rgb[2];
    if (cache.has(key)) return cache.get(key);
    const target = rgb.map((v) => lut[v]);
    let error = Infinity,
      detail = 1;
    for (const fit of fits) {
      const weights = fit.rows.map((row) => dot(row, target));
      if (weights.some((v) => v < -0.00001)) continue;
      const prediction = [0, 1, 2].map((c) =>
        weights.reduce((sum, v, i) => sum + v * bases[fit.ids[i]][c], 0),
      );
      const active = weights.filter((v) => v > 0.003).length;
      const distance =
        prediction.reduce((sum, v, i) => sum + (v - target[i]) ** 2, 0) +
        Math.max(0, active - 1) * 0.00001;
      if (distance < error) {
        error = distance;
        detail = weights.reduce((sum, v) => sum + v, 0);
      }
    }
    detail = Math.max(0.38, Math.min(1.45, detail));
    cache.set(key, detail);
    return detail;
  };
}
