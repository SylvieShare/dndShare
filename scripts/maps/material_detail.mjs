// Remove mixed material hues while retaining continuous baked grain/curvature.
import { OLD_STONE, srgbToLinear } from "./masonry_palette.mjs";
const bases = [[0.39, 0.22, 0.105], OLD_STONE, [0.34, 0.35, 0.33]].map((v) =>
  v.map(srgbToLinear),
);
const dot = (a, b) => a.reduce((n, v, i) => n + v * b[i], 0);
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const fits = [];
for (let i = 0; i < 3; i++)
  fits.push({
    ids: [i],
    rows: [bases[i].map((v) => v / dot(bases[i], bases[i]))],
  });
for (const [i, j] of [
  [0, 1],
  [0, 2],
  [1, 2],
]) {
  const aa = dot(bases[i], bases[i]),
    ab = dot(bases[i], bases[j]),
    bb = dot(bases[j], bases[j]),
    den = aa * bb - ab * ab;
  fits.push({
    ids: [i, j],
    rows: [
      bases[i].map((v, c) => (bb * v - ab * bases[j][c]) / den),
      bases[j].map((v, c) => (aa * v - ab * bases[i][c]) / den),
    ],
  });
}
const determinant = dot(bases[0], cross(bases[1], bases[2]));
fits.push({
  ids: [0, 1, 2],
  rows: [
    cross(bases[1], bases[2]),
    cross(bases[2], bases[0]),
    cross(bases[0], bases[1]),
  ].map((row) => row.map((v) => v / determinant)),
});
const linear = Array.from({ length: 256 }, (_, i) => srgbToLinear(i / 255));
export function bakedMaterialDetail(rgb) {
  const target = rgb.map((v) => linear[v]);
  let error = Infinity,
    detail = 1;
  for (const fit of fits) {
    const coefficients = fit.rows.map((row) => dot(row, target));
    if (coefficients.some((v) => v < -0.00001)) continue;
    const prediction = [0, 1, 2].map((c) =>
      coefficients.reduce((n, v, i) => n + v * bases[fit.ids[i]][c], 0),
    );
    // PNG quantisation must not invent a third material to explain one noisy byte.
    const active = coefficients.filter((v) => v > 0.003).length;
    const distance =
      prediction.reduce((n, v, i) => n + (v - target[i]) ** 2, 0) +
      Math.max(0, active - 1) * 0.00001;
    if (distance < error) {
      error = distance;
      detail = coefficients.reduce((n, v) => n + v, 0);
    }
  }
  return Math.max(0.38, Math.min(1.45, detail));
}
