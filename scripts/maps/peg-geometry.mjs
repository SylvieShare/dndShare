// Clip only insertion geometry, preserving body attributes and baked textures.
export function worldPoint(p, m) {
  return [
    m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
    m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
    m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14],
  ];
}
function triangles(primitive, matrix, visit) {
  const accessor = primitive.getAttribute("POSITION"),
    positions = accessor.getArray();
  const indices =
    primitive.getIndices()?.getArray() ||
    Uint32Array.from({ length: accessor.getCount() }, (_, i) => i);
  for (let i = 0; i < indices.length; i += 3) {
    const ids = [indices[i], indices[i + 1], indices[i + 2]];
    visit(
      ids,
      ids.map((id) =>
        worldPoint(positions.subarray(id * 3, id * 3 + 3), matrix),
      ),
    );
  }
}

export function sliceLoops(parts, plane) {
  const graph = new Map(),
    positions = new Map(),
    key = (p) => p.map((v) => Math.round(v * 10000)).join(",");
  for (const { primitive, matrix } of parts)
    triangles(primitive, matrix, (_, v) => {
      const points = [];
      for (const [i, j] of [
        [0, 1],
        [1, 2],
        [2, 0],
      ])
        if (v[i][1] < plane !== v[j][1] < plane) {
          const t = (plane - v[i][1]) / (v[j][1] - v[i][1]);
          points.push([
            v[i][0] + (v[j][0] - v[i][0]) * t,
            v[i][2] + (v[j][2] - v[i][2]) * t,
          ]);
        }
      if (points.length !== 2) return;
      const [a, b] = points.map(key);
      if (a === b) return;
      positions.set(a, points[0]);
      positions.set(b, points[1]);
      if (!graph.has(a)) graph.set(a, new Set());
      if (!graph.has(b)) graph.set(b, new Set());
      graph.get(a).add(b);
      graph.get(b).add(a);
    });
  const loops = [];
  while (graph.size) {
    const start = graph.keys().next().value,
      queue = [start],
      seen = new Set([start]),
      points = [];
    for (let i = 0; i < queue.length; i++) {
      const current = queue[i];
      points.push(positions.get(current));
      for (const next of graph.get(current) || [])
        if (!seen.has(next)) {
          seen.add(next);
          queue.push(next);
        }
    }
    for (const k of seen) graph.delete(k);
    if (points.length < 3) continue;
    const min = [
        Math.min(...points.map((p) => p[0])),
        Math.min(...points.map((p) => p[1])),
      ],
      max = [
        Math.max(...points.map((p) => p[0])),
        Math.max(...points.map((p) => p[1])),
      ];
    if ((max[0] - min[0]) * (max[1] - min[1]) > 0.04)
      loops.push({ min, max, center: min.map((v, i) => (v + max[i]) / 2) });
  }
  return loops;
}

export function clipBody(doc, primitive, matrix, height) {
  const semantics = primitive.listSemantics(),
    attrs = semantics.map((s) => primitive.getAttribute(s));
  const sizes = attrs.map((a) => a.getElementSize()),
    input = attrs.map((a) => a.getArray()),
    output = attrs.map(() => []);
  let count = 0;
  const read = (id) =>
    attrs.map((a, j) =>
      Array.from(input[j].subarray(id * sizes[j], (id + 1) * sizes[j])),
    );
  const interpolate = (a, b, t) =>
    a.map((vec, j) => vec.map((v, k) => v + (b[j][k] - v) * t));
  const emit = (v) => {
    for (let j = 0; j < semantics.length; j++) {
      const values = v[j].slice();
      if (semantics[j] === "NORMAL" || semantics[j] === "TANGENT") {
        const length = Math.hypot(...values.slice(0, 3)) || 1;
        for (let k = 0; k < 3; k++) values[k] /= length;
        if (semantics[j] === "TANGENT") values[3] = values[3] < 0 ? -1 : 1;
      }
      output[j].push(...values);
    }
    count++;
  };
  triangles(primitive, matrix, (ids, world) => {
    if (world.every((p) => Math.abs(p[1] - height) < 1e-6)) return;
    const original = ids.map((id, i) => ({ data: read(id), y: world[i][1] })),
      polygon = [];
    for (let i = 0; i < 3; i++) {
      const a = original[i],
        b = original[(i + 1) % 3],
        inside = a.y >= height,
        next = b.y >= height;
      if (inside) polygon.push(a.data);
      if (inside !== next)
        polygon.push(interpolate(a.data, b.data, (height - a.y) / (b.y - a.y)));
    }
    for (let i = 1; i < polygon.length - 1; i++) {
      emit(polygon[0]);
      emit(polygon[i]);
      emit(polygon[i + 1]);
    }
  });
  if (!count) throw new Error("Body clipping removed the entire model");
  primitive.setIndices(null);
  for (let j = 0; j < semantics.length; j++)
    primitive.setAttribute(
      semantics[j],
      doc
        .createAccessor(semantics[j])
        .setType(attrs[j].getType())
        .setArray(new Float32Array(output[j])),
    );
  return count / 3;
}

export function pegPrimitive(doc, pads, height, collection) {
  const positions = [],
    normals = [];
  function face(a, b, c) {
    const ab = b.map((v, i) => v - a[i]),
      ac = c.map((v, i) => v - a[i]);
    const n = [
        ab[1] * ac[2] - ab[2] * ac[1],
        ab[2] * ac[0] - ab[0] * ac[2],
        ab[0] * ac[1] - ab[1] * ac[0],
      ],
      length = Math.hypot(...n);
    if (!length) return;
    for (const p of [a, b, c]) {
      positions.push(...p);
      normals.push(...n.map((v) => v / length));
    }
  }
  for (const pad of pads) {
    const ring = (bounds, y) => [
      [bounds.min[0], y, bounds.min[1]],
      [bounds.max[0], y, bounds.min[1]],
      [bounds.max[0], y, bounds.max[1]],
      [bounds.min[0], y, bounds.max[1]],
    ];
    const top = ring(pad.top, height),
      bottom = ring(pad.bottom, 0);
    face(top[0], top[2], top[1]);
    face(top[0], top[3], top[2]);
    face(bottom[0], bottom[1], bottom[2]);
    face(bottom[0], bottom[2], bottom[3]);
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      face(top[i], top[j], bottom[j]);
      face(top[i], bottom[j], bottom[i]);
    }
  }
  const palette = {
    "lost-cave": [0.14, 0.085, 0.035, 1],
    "ultimate-dungeon": [0.22, 0.2, 0.16, 1],
    "toxic-sewer": [0.13, 0.15, 0.085, 1],
    "basic-elements": [0.2, 0.22, 0.25, 1],
  };
  const material = doc
    .createMaterial("Simple insertion pegs")
    .setBaseColorFactor(palette[collection])
    .setRoughnessFactor(0.9)
    .setMetallicFactor(0);
  return doc
    .createPrimitive()
    .setMaterial(material)
    .setAttribute(
      "POSITION",
      doc
        .createAccessor()
        .setType("VEC3")
        .setArray(new Float32Array(positions)),
    )
    .setAttribute(
      "NORMAL",
      doc.createAccessor().setType("VEC3").setArray(new Float32Array(normals)),
    );
}

export function measurePads(parts, height) {
  const middle = sliceLoops(parts, height / 2),
    low = sliceLoops(parts, Math.min(0.002, height * 0.05)),
    high = sliceLoops(parts, height - Math.min(0.0015, height * 0.02));
  if (!middle.length) throw new Error("No insertion-pad contours");
  const nearest = (points, p) =>
    points
      .slice()
      .sort(
        (a, b) =>
          Math.hypot(...a.center.map((v, i) => v - p.center[i])) -
          Math.hypot(...b.center.map((v, i) => v - p.center[i])),
      )[0] || p;
  return middle.map((mid) => {
    const bottom = nearest(low, mid),
      upper = nearest(high, mid),
      top = { min: [], max: [] };
    for (let i = 0; i < 2; i++) {
      let width = upper.max[i] - upper.min[i];
      if (Math.abs(width - 1) < 0.04) width = 1;
      width = Math.max(width, bottom.max[i] - bottom.min[i]);
      top.min[i] = mid.center[i] - width / 2;
      top.max[i] = mid.center[i] + width / 2;
    }
    return { top, bottom };
  });
}
