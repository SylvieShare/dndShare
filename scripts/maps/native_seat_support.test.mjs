import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import {
  nativeSeatSupport,
  nativeFrameCellCentre,
} from "./native_seat_support.mjs";
const require = createRequire("/private/tmp/dndshare-model-tools/package.json");
const { BufferGeometry, BufferAttribute } = require("three");
const { MeshBVH } = require("three-mesh-bvh");
const body = Float32Array.from([0, 0, 10, 1, 2, 10, 2, 0, 10]);
test("native north is the first local row of a multi-row frame", () => {
  assert.deepEqual(nativeFrameCellCentre(2, 2, 0, 0), [-17.5, 17.5]);
  assert.deepEqual(nativeFrameCellCentre(3, 2, 2, 1), [35, -17.5]);
  for (let y = 0; y < 2; y++)
    for (let x = 0; x < 3; x++) {
      const [cx, cy] = nativeFrameCellCentre(3, 2, x, y);
      assert.equal(1.5 + cx / 35, x + 0.5);
      assert.equal(1 - cy / 35, y + 0.5);
    }
});
function frame(cx = 0, cy = 0) {
  const source = Float32Array.from(
    [
      [0, 1.5, 20],
      [2, 1.5, 22],
      [1, -0.5, 21],
    ].flatMap(([x, y, z]) => [x + cx, y + cy, z]),
  );
  const flat = source.map((v, i) => (i % 3 === 2 ? 0 : v)),
    geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(flat, 3));
  return { source, geometry, tree: new MeshBVH(geometry) };
}
test("limiting contact is a new edge intersection, outside all six input vertices", () => {
  const f = frame(),
    result = nativeSeatSupport(body, f.source, f.geometry, f.tree, 0, 0, 17);
  assert.ok(Math.abs(result.minimumSeatMM - 28.625) < 1e-6);
  assert.ok(Math.abs(result.verifiedSeatMM - 28.645) < 1e-6);
  assert.ok(Math.abs(result.contact.pointMM[0] - 1.625) < 1e-6);
  assert.ok(Math.abs(result.contact.pointMM[1] - 0.75) < 1e-6);
  f.geometry.dispose();
});
test("a translated frame cell preserves seating and disjoint projections have no contact", () => {
  const f = frame(35, -35),
    result = nativeSeatSupport(body, f.source, f.geometry, f.tree, 35, -35, 17);
  assert.ok(Math.abs(result.minimumSeatMM - 28.625) < 1e-6);
  assert.ok(Math.abs(result.contact.pointMM[0] - 36.625) < 1e-6);
  assert.equal(
    nativeSeatSupport(body, f.source, f.geometry, f.tree, 100, 100, 17)
      .minimumSeatMM,
    -Infinity,
  );
  f.geometry.dispose();
});
test("a fully contained frame triangle uses its highest exact support value", () => {
  const f = frame(),
    large = Float32Array.from([-10, -10, 10, 0, 20, 10, 10, -10, 10]);
  const result = nativeSeatSupport(
    large,
    f.source,
    f.geometry,
    f.tree,
    0,
    0,
    17,
  );
  assert.equal(result.minimumSeatMM, 29);
  assert.deepEqual(result.contact.pointMM, [2, 1.5, 22]);
  f.geometry.dispose();
});
