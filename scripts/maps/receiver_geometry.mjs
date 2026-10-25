import { createRequire } from "node:module";
const require = createRequire("/private/tmp/dndshare-model-tools/package.json");
const {
    BufferGeometry,
    BufferAttribute,
    Ray,
    Vector3,
    DoubleSide,
  } = require("three"),
  { MeshBVH } = require("three-mesh-bvh");
export const SOCKET_PROBE_VERSION = 3;
export function sourceSocketProbes(source, row, cells = [{ x: 0, y: 0, centerMM: [0, 0] }]) {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(source, 3));
  const tree = new MeshBVH(geometry);
  const probes = [];
  for (const cell of cells) {
    const [cx, cy] = cell.centerMM;
    const floor = tree.raycastFirst(
      new Ray(new Vector3(cx, cy, row.max[2] + 1), new Vector3(0, 0, -1)),
      DoubleSide,
    );
    const start = (floor?.point.z ?? row.min[2]) + 0.5;
    for (let z = start; z <= row.max[2] + 0.5; z += 0.5)
      for (const axis of [0, 1])
        for (const side of [-1, 1])
          for (const offset of [-10, -5, 0, 5, 10]) {
            const origin = [cx, cy, z],
              direction = [0, 0, 0];
            origin[1 - axis] += offset;
            direction[axis] = side;
            const hit = tree.raycastFirst(
              new Ray(new Vector3(...origin), new Vector3(...direction)),
              DoubleSide,
            );
            probes.push({
              cell: { x: cell.x, y: cell.y },
              origin,
              direction,
              point: hit ? hit.point.toArray() : null,
            });
          }
    for (const x of [-12, -8, -4, 0, 4, 8, 12])
      for (const y of [-12, -8, -4, 0, 4, 8, 12]) {
        const origin = [cx + x, cy + y, row.max[2] + 1],
          direction = [0, 0, -1];
        const hit = tree.raycastFirst(
          new Ray(new Vector3(...origin), new Vector3(...direction)),
          DoubleSide,
        );
        probes.push({
          cell: { x: cell.x, y: cell.y },
          origin,
          direction,
          point: hit ? hit.point.toArray() : null,
        });
      }
  }
  geometry.dispose();
  return probes;
}
export function receiverTriangles(doc, bias) {
  const out = [];
  for (const node of doc.getRoot().listNodes())
    if (node.getMesh())
      for (const p of node.getMesh().listPrimitives()) {
        const m = node.getWorldMatrix(),
          pos = p.getAttribute("POSITION"),
          idx = p.getIndices();
        for (let i = 0; i < idx.getCount(); i++) {
          const v = pos.getElement(idx.getScalar(i), []),
            w = [0, 1, 2].map(
              (a) =>
                m[a] * v[0] + m[a + 4] * v[1] + m[a + 8] * v[2] + m[a + 12],
            );
          out.push(w[0] * 35, -w[2] * 35, w[1] * 35 + bias);
        }
      }
  return Float64Array.from(out);
}
