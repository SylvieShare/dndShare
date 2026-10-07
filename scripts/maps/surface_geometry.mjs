// UV repacking may split/reorder vertices; compare the actual accepted triangles.
export function assertSameSurface(before, after, tolerance = 3e-6) {
  const grid = new Map(),
    points = [],
    expected = new Map();
  const cell = (p) => p.map((v) => Math.floor(v / tolerance));
  const key = (p) => p.join(",");
  function find(p, create) {
    const c = cell(p);
    for (let x = -1; x <= 1; x++)
      for (let y = -1; y <= 1; y++)
        for (let z = -1; z <= 1; z++)
          for (const i of grid.get(key([c[0] + x, c[1] + y, c[2] + z])) || [])
            if (Math.hypot(...p.map((v, j) => v - points[i][j])) <= tolerance)
              return i;
    if (!create) throw new Error("Accepted vertex position changed");
    const i = points.length;
    points.push(p);
    const k = key(c);
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k).push(i);
    return i;
  }
  function triangles(doc, create, visit) {
    for (const node of doc.getRoot().listNodes()) {
      if (!node.getMesh()) continue;
      const m = node.getWorldMatrix();
      for (const primitive of node.getMesh().listPrimitives()) {
        const pos = primitive.getAttribute("POSITION"),
          indices = primitive.getIndices();
        for (let i = 0; i < indices.getCount(); i += 3) {
          const ids = [];
          for (let j = 0; j < 3; j++) {
            const p = pos.getElement(indices.getScalar(i + j), []),
              w = Array.from(
                { length: 3 },
                (_, a) =>
                  m[a] * p[0] + m[4 + a] * p[1] + m[8 + a] * p[2] + m[12 + a],
              );
            ids.push(find(w, create));
          }
          if (new Set(ids).size < 3) continue;
          const [a, b, c] = ids.map((id) => points[id]),
            u = b.map((v, j) => v - a[j]),
            v = c.map((q, j) => q - a[j]);
          if (
            Math.hypot(
              u[1] * v[2] - u[2] * v[1],
              u[2] * v[0] - u[0] * v[2],
              u[0] * v[1] - u[1] * v[0],
            ) < 1e-12
          )
            continue;
          visit(ids.sort((a, b) => a - b).join(","));
        }
      }
    }
  }
  triangles(before, true, (k) => expected.set(k, (expected.get(k) || 0) + 1));
  let checked = 0;
  triangles(after, false, (k) => {
    const n = expected.get(k) || 0;
    if (!n) throw new Error("Accepted triangle surface changed");
    expected.set(k, n - 1);
    checked++;
  });
  if ([...expected.values()].some((n) => n !== 0))
    throw new Error("Accepted triangle surface removed");
  return { triangles: checked, positions: points.length, tolerance };
}
