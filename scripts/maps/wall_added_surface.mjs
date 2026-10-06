// Distance grids only cover the intersection with the two original stone walls.
export function addedWallSurface([x, y, z], reference) {
  if (!reference) return false;
  const s = reference.spec;
  if (z < s.zMin || z > s.zMax) return false;
  const at = (axis, a, t) => {
    if (a < s.near || a > s.far || t < s.min || t > s.far) return null;
    const i = Math.round((a - s.near) / s.step),
      j = Math.round((t - s.min) / s.step),
      k = Math.round((z - s.zMin) / s.step);
    return (
      reference[axis][(k * s.spanSize + j) * s.slabSize + i] / s.distanceScale
    );
  };
  const values = [at("x", x, y), at("y", y, x)].filter((v) => v !== null);
  return values.length > 0 && Math.min(...values) > 0.35;
}
