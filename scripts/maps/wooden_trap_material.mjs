const clamp = (v) => Math.max(0, Math.min(1, v));
function nearChain(p, path) {
  return path.slice(1).some((b, i) => {
    const a = path[i],
      d = b.map((v, j) => v - a[j]);
    const t = clamp(
      d.reduce((s, v, j) => s + v * (p[j] - a[j]), 0) /
        d.reduce((s, v) => s + v * v, 0),
    );
    return Math.hypot(...p.map((v, j) => v - a[j] - t * d[j])) < 1.4;
  });
}
export function woodenTrapPartAt(p, spec, n = [-1, 0, 0]) {
  const [x, y, z] = p;
  const tip =
    x < 11.4 &&
    z > 30 &&
    [-10.5, 0, 10.5].some((cy) => Math.abs(y - cy) < 2.75);
  if (x < 10.9 && z > 18.8 && spec.chains.some((path) => nearChain(p, path)))
    return "iron";
  if (x > 9.3 && z > 29 && n[0] < -0.85 && Math.abs(n[2]) < 0.35)
    return "stone";
  if (
    x > -13.7 &&
    (x < 9.9 || tip || (x < 11.4 && n[0] > 0.05)) &&
    Math.abs(y) < 15.2 &&
    z > 14.5 &&
    z < 36.7
  )
    return "wood";
  return "stone";
}
export function trapWoodFrame([x, y, z]) {
  const rows = [-10.5, 0, 10.5],
    row = rows.reduce(
      (best, v) => (Math.abs(v - y) < Math.abs(best - y) ? v : best),
      0,
    );
  const upright = x > 6.4 && Math.abs(y - row) < 3.0 && z > 19;
  return {
    axis: upright ? "z" : x > 3.5 ? "y" : "x",
    centre: [8, row, z < 22 ? 18.4 : 28],
  };
}
