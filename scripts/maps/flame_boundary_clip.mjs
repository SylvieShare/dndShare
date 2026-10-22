import assert from "node:assert/strict";

// Opt-in clipping for fire joined to small fuel details. Entire unaffected
// triangles retain their original attributes; only boundary triangles split.
export function clipMeasuredFlameBoundaries(
  document,
  matches,
  shiftMM,
  options,
) {
  const tolerance = options.toleranceMM;
  assert.ok(Number.isFinite(tolerance) && tolerance > 0 && tolerance <= 1);
  const boxes = options.boundsMM || [],
    protectedBoxes = options.preserveRegions || [];
  assert.ok(boxes.length);
  for (const box of [...boxes, ...protectedBoxes])
    assert.ok(
      box.minMM.length === 3 &&
        box.maxMM.length === 3 &&
        box.minMM.every((v, i) => Number.isFinite(v) && v < box.maxMM[i]),
    );
  const overlap = (v, box) =>
    [0, 1, 2].every(
      (i) =>
        Math.min(...v.map((p) => p[i])) <= box.maxMM[i] &&
        Math.max(...v.map((p) => p[i])) >= box.minMM[i],
    );
  const counts = [],
    removedBounds = {
      min: [Infinity, Infinity, Infinity],
      max: [-Infinity, -Infinity, -Infinity],
    };
  for (const node of document.getRoot().listNodes())
    if (node.getMesh())
      for (const primitive of node.getMesh().listPrimitives()) {
        const position = primitive.getAttribute("POSITION"),
          index = primitive.getIndices();
        assert.ok(index && primitive.getMode() === 4);
        const semantics = primitive.listSemantics(),
          attributes = semantics.map((s) => primitive.getAttribute(s));
        assert.ok(
          attributes.every(
            (a) => a.getArray() instanceof Float32Array && !a.getNormalized(),
          ),
          "Clip flame boundaries before attribute quantization",
        );
        const matrix = node.getWorldMatrix(),
          native = Array.from({ length: position.getCount() }, (_, i) => {
            const p = position.getElement(i, []),
              w = [0, 1, 2].map(
                (k) =>
                  matrix[k] * p[0] +
                  matrix[k + 4] * p[1] +
                  matrix[k + 8] * p[2] +
                  matrix[k + 12],
              );
            return [
              w[0] * 35 + shiftMM[0],
              -w[2] * 35 + shiftMM[1],
              w[1] * 35 + shiftMM[2],
            ];
          });
        const matched = native.map((p) => matches(p)),
          output = [];
        let affected = 0,
          split = 0;
        for (let i = 0; i < index.getCount(); i += 3) {
          const ids = [0, 1, 2].map((j) => index.getScalar(i + j)),
            points = ids.map((id) => native[id]);
          if (!boxes.some((b) => overlap(points, b))) {
            output.push(...ids);
            continue;
          }
          const initial = ids.map((id, j) => ({
            p: native[id],
            w: [0, 1, 2].map((k) => (k === j ? 1 : 0)),
            inside: matched[id],
            id,
          }));
          const middle = (a, b) => {
            const p = a.p.map((v, k) => (v + b.p[k]) / 2);
            return {
              p,
              w: a.w.map((v, k) => (v + b.w[k]) / 2),
              inside: matches(p),
            };
          };
          let changed = false,
            wasSplit = false;
          const emit = (polygon) => {
            for (let j = 1; j + 1 < polygon.length; j++)
              for (const v of [polygon[0], polygon[j], polygon[j + 1]])
                output.push(v.id === undefined ? { ids, w: v.w } : v.id);
          };
          const root = (a, b) => {
            let outside = a.inside ? b : a,
              inside = a.inside ? a : b;
            for (let k = 0; k < 20; k++) {
              const m = middle(outside, inside);
              if (m.inside) inside = m;
              else outside = m;
            }
            return outside;
          };
          const visit = (v, depth) => {
            const center = v[0].p.map((_, k) =>
                v.reduce((sum, q) => sum + q.p[k] / 3, 0),
              ),
              centerInside = matches(center),
              ab = middle(v[0], v[1]),
              bc = middle(v[1], v[2]),
              ca = middle(v[2], v[0]),
              samples = [...v, ab, bc, ca],
              any = samples.some((q) => q.inside) || centerInside;
            if (!any) {
              emit(v);
              return;
            }
            const all = samples.every((q) => q.inside) && centerInside,
              size = Math.max(
                ...[
                  [0, 1],
                  [1, 2],
                  [2, 0],
                ].map(([a, b]) =>
                  Math.hypot(...v[a].p.map((p, k) => p - v[b].p[k])),
                ),
              ),
              protect = protectedBoxes.some((b) =>
                overlap(
                  v.map((q) => q.p),
                  b,
                ),
              );
            if (all && (!protect || size <= tolerance)) {
              changed = true;
              return;
            }
            if (size > tolerance) {
              assert.ok(depth < 18, "Flame boundary did not converge");
              changed = true;
              wasSplit = true;
              for (const child of [
                [v[0], ab, ca],
                [ab, v[1], bc],
                [ca, bc, v[2]],
                [ab, bc, ca],
              ])
                visit(child, depth + 1);
              return;
            }
            changed = true;
            wasSplit = true;
            const polygon = [];
            for (let j = 0; j < 3; j++) {
              const a = v[j],
                b = v[(j + 1) % 3];
              if (!a.inside) polygon.push(a);
              if (a.inside !== b.inside) polygon.push(root(a, b));
            }
            if (polygon.length >= 3) emit(polygon);
          };
          visit(initial, 0);
          if (changed) {
            affected++;
            if (wasSplit) split++;
            for (const p of points)
              for (let k = 0; k < 3; k++) {
                removedBounds.min[k] = Math.min(removedBounds.min[k], p[k]);
                removedBounds.max[k] = Math.max(removedBounds.max[k], p[k]);
              }
          }
        }
        const before = index.getCount() / 3;
        if (affected) {
          const arrays = attributes.map(() => []),
            mapping = new Map(),
            indices = [];
          for (const vertex of output) {
            if (!mapping.has(vertex)) {
              mapping.set(vertex, mapping.size);
              for (let j = 0; j < attributes.length; j++) {
                const attribute = attributes[j];
                let values;
                if (typeof vertex === "number")
                  values = attribute.getElement(vertex, []);
                else
                  values = Array.from(
                    { length: attribute.getElementSize() },
                    (_, k) =>
                      vertex.ids.reduce(
                        (sum, id, n) =>
                          sum + attribute.getElement(id, [])[k] * vertex.w[n],
                        0,
                      ),
                  );
                if (
                  typeof vertex !== "number" &&
                  ["NORMAL", "TANGENT"].includes(semantics[j])
                ) {
                  const length = Math.hypot(...values.slice(0, 3));
                  assert.ok(length > 0);
                  for (let k = 0; k < 3; k++) values[k] /= length;
                  if (semantics[j] === "TANGENT")
                    values[3] = values[3] < 0 ? -1 : 1;
                }
                arrays[j].push(...values);
              }
            }
            indices.push(mapping.get(vertex));
          }
          for (let j = 0; j < attributes.length; j++)
            primitive.setAttribute(
              semantics[j],
              attributes[j].clone().setArray(new Float32Array(arrays[j])),
            );
          primitive.setIndices(
            index.clone().setArray(new Uint32Array(indices)),
          );
        }
        counts.push({
          node: node.getName(),
          before,
          removed: affected,
          clipped: split,
          after: primitive.getIndices().getCount() / 3,
        });
      }
  assert.ok(
    counts.some((p) => p.removed > 0),
    "No sculptural fire found",
  );
  for (const m of document.getRoot().listMaterials()) {
    m.setEmissiveTexture(null).setEmissiveFactor([0, 0, 0]);
    if (m.getExtension("KHR_materials_emissive_strength"))
      m.setExtension("KHR_materials_emissive_strength", null);
  }
  return { counts, removedBounds, boundaryToleranceMM: tolerance };
}
