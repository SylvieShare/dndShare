export function wagonReferenceDistance(p, reference) {
  const s = reference.spec,
    index = p.map((v, i) => Math.round((v - s.low[i]) / s.step));
  if (index.some((v, i) => v < 0 || v >= s.size[i])) return Infinity;
  return (
    reference.data[(index[2] * s.size[1] + index[1]) * s.size[0] + index[0]] /
    s.scale
  );
}
