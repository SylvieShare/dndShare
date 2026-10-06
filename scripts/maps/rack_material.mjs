const clamp = (v) => Math.max(0, Math.min(1, v));
const ellipsoid = (p, h) =>
  p.reduce((s, v, i) => s + ((v - h.centre[i]) / h.radius[i]) ** 2, 0) < 1.05;
function nearPath(p, path) {
  return path.slice(1).some((b, i) => {
    const a = path[i],
      d = b.map((v, j) => v - a[j]);
    const t = clamp(
      d.reduce((s, v, j) => s + v * (p[j] - a[j]), 0) /
        d.reduce((s, v) => s + v * v, 0),
    );
    return Math.hypot(...p.map((v, j) => v - a[j] - t * d[j])) < 1.2;
  });
}
export function rackPartAt(p, spec) {
  const [x, y, z] = p;
  if (spec.heads.some((h) => z > h.minZ && ellipsoid(p, h))) return "bone";
  const boardHeight = 23.62 + 0.267 * x;
  const lowChains =
    z > 14.55 && spec.lowChains.some((path) => nearPath(p, path));
  const upperChains =
    z > boardHeight + 0.1 && spec.upperChains.some((path) => nearPath(p, path));
  const ring = spec.rings.some(
    ([cx, cy]) =>
      Math.abs(Math.hypot(x - cx, y - cy) - 1.35) < 0.55 &&
      z > boardHeight + 0.12 &&
      z < boardHeight + 2.3,
  );
  const clampBar =
    x > -24.2 &&
    x < -21.5 &&
    Math.abs(y) > 3.0 &&
    Math.abs(y) < 11.3 &&
    z > boardHeight + 0.45;
  const hardware = x > 17.0 && x < 28.5 && z > 31 && Math.abs(y) < 16;
  const sideWheel =
    x > 16.0 &&
    x < 29.0 &&
    Math.abs(y) > 10.5 &&
    Math.abs(y) < 16.5 &&
    z > 25.7;
  const roller = Math.hypot(x - 22.5, z - 32) < 4.3 && Math.abs(y) < 8.6;
  if (lowChains || upperChains || ring || clampBar) return "iron";
  if (hardware || sideWheel) return roller ? "roller" : "iron";
  if (x > -29.0 && x < 26 && Math.abs(y) < 13.45 && z > 14.8) return "wood";
  return "stone";
}
