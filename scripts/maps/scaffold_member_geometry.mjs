const cache = new WeakMap();
const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
const unit = (a) => {
  const length = Math.hypot(...a);
  if (!(length > 0)) throw new Error("Nonzero member direction required");
  return a.map((v) => v / length);
};
export function scaffoldMemberBasis(member) {
  if (cache.has(member)) return cache.get(member);
  const axis = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] }[member.axis];
  const a = unit(member.direction || axis);
  let b = member.axis === "x" ? [0, 1, 0] : [1, 0, 0];
  const projection = dot(a, b);
  b = unit(b.map((v, i) => v - a[i] * projection));
  const c = [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
  const basis = { a, b, c };
  cache.set(member, basis);
  return basis;
}
export function scaffoldMemberCoordinates(p, n, member) {
  const { a, b, c } = scaffoldMemberBasis(member);
  const local = p.map((v, i) => v - member.centre[i]);
  return {
    p: [dot(local, a), dot(local, b), dot(local, c)],
    n: [dot(n, a), dot(n, b), dot(n, c)],
  };
}
export function scaffoldMemberAt(p, members) {
  for (const m of members) {
    const q = scaffoldMemberCoordinates(p, [0, 0, 0], m).p;
    if (
      Math.abs(q[0]) <= m.length / 2 &&
      Math.abs(q[1]) <= m.halfWidth &&
      Math.abs(q[2]) <= m.halfDepth &&
      (!m.round || Math.hypot(q[1] / m.halfWidth, q[2] / m.halfDepth) <= 1)
    )
      return m;
  }
}
export function scaffoldOrientedBoltAt(p, bolts) {
  return bolts.find((b) => {
    const q = p.map((v, i) => v - b.centre[i]);
    const normal = unit(b.normal);
    const u = unit(b.u);
    const v = [
      normal[1] * u[2] - normal[2] * u[1],
      normal[2] * u[0] - normal[0] * u[2],
      normal[0] * u[1] - normal[1] * u[0],
    ];
    const depth = dot(q, normal);
    return (
      depth >= b.depth[0] &&
      depth <= b.depth[1] &&
      Math.hypot(dot(q, u) / b.radius[0], dot(q, v) / b.radius[1]) <= 1
    );
  });
}
