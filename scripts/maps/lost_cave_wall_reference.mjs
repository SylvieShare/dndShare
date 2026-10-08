export function wallReferenceDistance(p, reference) {
  const s = reference.spec,
    q = p.map((v, i) => (v - s.low[i]) / s.step);
  if (q.some((v, i) => v < 0 || v > s.size[i] - 1)) return Infinity;
  const lo = q.map(Math.floor),
    hi = lo.map((v, i) => Math.min(v + 1, s.size[i] - 1)),
    t = q.map((v, i) => v - lo[i]);
  let value = 0;
  for (let z = 0; z < 2; z++)
    for (let y = 0; y < 2; y++)
      for (let x = 0; x < 2; x++) {
        const i =
          (((z ? hi[2] : lo[2]) * s.size[1] + (y ? hi[1] : lo[1])) * s.size[0] +
            (x ? hi[0] : lo[0])) *
          2;
        value +=
          (reference.data.readUInt16LE(i) / s.scale) *
          (x ? t[0] : 1 - t[0]) *
          (y ? t[1] : 1 - t[1]) *
          (z ? t[2] : 1 - t[2]);
      }
  return value;
}
