function contains([x, y], polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [a, b] = polygon[i],
      [c, d] = polygon[j];
    if (b > y !== d > y && x < ((c - a) * (y - b)) / (d - b) + a)
      inside = !inside;
  }
  return inside;
}
export function projectedBoneAt(p, view, polygons, toleranceMM = 0.6) {
  const s = view.spec,
    d = p.map((v, i) => v - s.centre[i]);
  const dot = (v) => v.reduce((n, a, i) => n + a * d[i], 0);
  const pixel = [
    (dot(s.right) / s.scaleMM + 0.5) * s.size,
    (0.5 - dot(s.up) / s.scaleMM) * s.size,
  ];
  if (!polygons.some((poly) => contains(pixel, poly))) return false;
  const x = Math.floor(pixel[0]),
    y = Math.floor(pixel[1]);
  if (x < 0 || y < 0 || x >= s.size || y >= s.size) return false;
  const nearest = view.data.readFloatLE((y * s.size + x) * 4);
  return (
    Number.isFinite(nearest) &&
    Math.abs(dot(s.outward) - nearest) <= toleranceMM
  );
}
