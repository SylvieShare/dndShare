// Exact vertical separation over the intersection of projected triangles.
import { createRequire } from "node:module";
const require = createRequire("/private/tmp/dndshare-model-tools/package.json");
const { Box3, Vector3 } = require("three");
export function nativeFrameCellCentre(width, height, x, y) {
  return [(x - (width - 1) / 2) * 35, ((height - 1) / 2 - y) * 35];
}
export function nativeSeatSupport(body, frame, g, tree, cx, cy, datum) {
  let best = -Infinity,
    contact,
    overlaps = 0;
  const index = g.getIndex();
  for (let t = 0; t < body.length; t += 9) {
    const A = [body[t] + cx, body[t + 1] + cy, body[t + 2]],
      B = [body[t + 3] + cx, body[t + 4] + cy, body[t + 5]],
      C = [body[t + 6] + cx, body[t + 7] + cy, body[t + 8]];
    const nx = (B[1] - A[1]) * (C[2] - A[2]) - (B[2] - A[2]) * (C[1] - A[1]);
    const ny = (B[2] - A[2]) * (C[0] - A[0]) - (B[0] - A[0]) * (C[2] - A[2]);
    const nz = (B[0] - A[0]) * (C[1] - A[1]) - (B[1] - A[1]) * (C[0] - A[0]);
    const sign = nz > 0 ? 1 : -1,
      clip = [A, B, C];
    const box = new Box3(
      new Vector3(
        Math.min(A[0], B[0], C[0]) - 1e-7,
        Math.min(A[1], B[1], C[1]) - 1e-7,
        -0.001,
      ),
      new Vector3(
        Math.max(A[0], B[0], C[0]) + 1e-7,
        Math.max(A[1], B[1], C[1]) + 1e-7,
        0.001,
      ),
    );
    tree.shapecast({
      intersectsBounds: (bounds) => bounds.intersectsBox(box),
      intersectsTriangle: (_tri, id) => {
        const vertex = index.getX(id * 3),
          original = Math.floor(vertex / 3),
          offset = original * 9;
        let entirelyInside = true;
        for (let i = 0; i < 3; i++) {
          const a = clip[i],
            b = clip[(i + 1) % 3];
          let outside = 0;
          for (let j = 0; j < 3; j++) {
            const k = offset + j * 3,
              d =
                sign *
                ((b[0] - a[0]) * (frame[k + 1] - a[1]) -
                  (b[1] - a[1]) * (frame[k] - a[0]));
            if (d < 0) {
              outside++;
              entirelyInside = false;
            }
          }
          if (outside === 3) return false;
        }
        if (entirelyInside) {
          overlaps++;
          for (let j = 0; j < 3; j++) {
            const k = offset + j * 3,
              bodyZ =
                A[2] -
                (nx * (frame[k] - A[0]) + ny * (frame[k + 1] - A[1])) / nz;
            const seat = frame[k + 2] - bodyZ + datum;
            if (seat > best) {
              best = seat;
              contact = {
                pointMM: [frame[k], frame[k + 1], frame[k + 2]],
                bodyNativeZ: bodyZ,
                bodyTriangle: t / 9,
                frameTriangle: original,
              };
            }
          }
          return false;
        }
        let polygon = [
          [frame[offset], frame[offset + 1], frame[offset + 2]],
          [frame[offset + 3], frame[offset + 4], frame[offset + 5]],
          [frame[offset + 6], frame[offset + 7], frame[offset + 8]],
        ];
        for (let i = 0; i < 3 && polygon.length; i++) {
          const a = clip[i],
            b = clip[(i + 1) % 3],
            out = [];
          const distance = (p) =>
            sign *
            ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]));
          for (let j = 0; j < polygon.length; j++) {
            const p = polygon[j],
              q = polygon[(j + 1) % polygon.length],
              d = distance(p),
              e = distance(q),
              inside = d >= 0,
              next = e >= 0;
            if (inside) out.push(p);
            if (inside !== next) {
              const f = d / (d - e);
              out.push(p.map((v, k) => v + (q[k] - v) * f));
            }
          }
          polygon = out;
        }
        if (polygon.length) overlaps++;
        for (const p of polygon) {
          const bodyZ = A[2] - (nx * (p[0] - A[0]) + ny * (p[1] - A[1])) / nz;
          const seat = p[2] - bodyZ + datum;
          if (seat > best) {
            best = seat;
            contact = {
              pointMM: p,
              bodyNativeZ: bodyZ,
              bodyTriangle: t / 9,
              frameTriangle: original,
            };
          }
        }
        return false;
      },
    });
  }
  return {
    minimumSeatMM: best,
    verifiedSeatMM: best + 0.02,
    contact,
    overlaps,
  };
}
