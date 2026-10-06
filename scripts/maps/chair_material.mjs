const clamp = (v) => Math.max(0, Math.min(1, v));
function onBone(p, path) {
  return path.slice(1).some((b, i) => {
    const a = path[i],
      d = b.map((v, j) => v - a[j]);
    const t = clamp(
      d.reduce((s, v, j) => s + v * (p[j] - a[j]), 0) /
        d.reduce((s, v) => s + v * v, 0),
    );
    return Math.hypot(...p.map((v, j) => v - a[j] - t * d[j])) < 1.0;
  });
}
export function chairPartAt(p, spec) {
  const [x, y, z] = p;
  if (z > 14.15 && z < 17.4 && spec.bones.some((path) => onBone(p, path)))
    return "bone";
  if (x > -16.5 && x < 9.0 && Math.abs(y) < 12.25 && z > 15.05 && z < 17.3)
    return "wood";
  const wall = x > 11.35 && z < 38.5;
  if (!wall && x > -15.8 && x < 14.8 && Math.abs(y) < 16.3 && z > 17.2)
    return "iron";
  return "stone";
}
