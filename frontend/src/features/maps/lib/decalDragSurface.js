const dot = (a, b) => a.reduce((sum, value, i) => sum + value * b[i], 0);
function basis(normal, rotation) {
  const up = Math.abs(normal[1]) > 0.95 ? [0, 0, -1] : [0, 1, 0];
  const cross = (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
  let x = cross(up, normal);
  x = x.map((value) => value / Math.hypot(...x));
  const y = cross(normal, x),
    angle = (rotation * Math.PI) / 180;
  return [
    x.map((v, i) => v * Math.cos(angle) + y[i] * Math.sin(angle)),
    y.map((v, i) => v * Math.cos(angle) - x[i] * Math.sin(angle)),
  ];
}

export function dragDecalSurface(decal, grab, target) {
  if (!grab || !target) return null;
  const parallel =
    decal.anchor.kind === target.anchor.kind &&
    decal.anchor.id === target.anchor.id &&
    dot(decal.normal, target.normal) > 0.98;
  const normal = parallel ? decal.normal : target.normal;
  const oldBasis = basis(decal.normal, decal.rotation),
    nextBasis = basis(normal, decal.rotation);
  const offset = grab.position.map((value, i) => value - decal.position[i]);
  const [u, v] = oldBasis.map((axis) => dot(offset, axis));
  let position = target.position.map(
    (value, i) => value - nextBasis[0][i] * u - nextBasis[1][i] * v,
  );
  if (parallel) {
    // Passing over raised stones should not pull the paint's reference plane up.
    const height = dot(
      position.map((value, i) => value - decal.position[i]),
      normal,
    );
    position = position.map((value, i) => value - height * normal[i]);
  }
  return { ...target, normal: [...normal], position };
}
