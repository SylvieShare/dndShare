import test from "node:test";
import assert from "node:assert/strict";
import specs from "./ultimate-double-doors.json" with { type: "json" };
import {
  doubleDoorPartAt,
  doorWoodFrame,
  makeDoubleDoorPainter,
} from "./double_door_material.mjs";
const spec = specs["UD-082"],
  floor = { size: 2, min: -17.5, step: 35, heights: [14, 14, 14, 14] };
test("door planks and curved frame remain wood while the skull receives ivory", () => {
  assert.equal(
    doubleDoorPartAt([11.1141, 6.9309, 43.2023], spec, floor),
    "wood",
  );
  assert.equal(
    doubleDoorPartAt([10.502, -2.8201, 72.7914], spec, floor),
    "frame",
  );
  assert.equal(
    doubleDoorPartAt([8.4066, -4.8409, 59.4827], spec, floor),
    "bone",
  );
  assert.equal(
    doubleDoorPartAt([8.0658, -8.9939, 49.9465], spec, floor),
    "bone",
  );
});
test("front and back fittings are iron without repainting their backing panels", () => {
  for (const p of [
    [10.418, 10.7644, 41.6823],
    [9.4026, -13.6516, 34.4645],
    [15.5864, -3.2569, 51.3031],
    [17.4614, 14.338, 35.4189],
  ])
    assert.equal(doubleDoorPartAt(p, spec, floor), "iron");
  assert.equal(
    doubleDoorPartAt([14.2519, -1.3551, 41.2628], spec, floor),
    "wood",
  );
  assert.equal(
    doubleDoorPartAt([14.8666, -16.1283, 65.3402], spec, floor),
    "frame",
  );
});
test("measured chain stays iron and the floor below a chain loop stays stone", () => {
  assert.equal(
    doubleDoorPartAt([-0.4642, 12.6288, 15.8589], spec, floor),
    "iron",
  );
  assert.equal(doubleDoorPartAt([-0.4642, 12.6288, 14], spec, floor), "stone");
});
test("frame grain follows the arch tangent and the lower rail runs crosswise", () => {
  const angle = 0.7,
    p = [10.5, 33 * Math.cos(angle) - 17.5, 33 * Math.sin(angle) + 41.5];
  const frame = doorWoodFrame(p, [0, -Math.sin(angle), Math.cos(angle)]);
  assert.equal(frame.axis, "z");
  assert.ok(Math.abs(frame.n[2] - 1) < 1e-8);
  assert.equal(doorWoodFrame([10.5, 0, 16], [0, 0, 1]).axis, "y");
});
test("mirrored side view preserves the whole skull and collar faces, with timber between collars", () => {
  const paint = makeDoubleDoorPainter(specs["UD-083"], floor);
  const part = (p) => paint([137, 130, 115], p, [-1, 0, 0], 255).part;
  assert.equal(part([10.098, -2.247, 56.7738]), "bone");
  assert.equal(part([9.5982, -1.6078, 52.4037]), "bone");
  assert.equal(part([11.9571, -17.36, 34.758]), "iron");
  assert.equal(part([12.4319, -17.4557, 20.2467]), "iron");
  assert.equal(part([12.3284, -16.8309, 28.2008]), "frame");
});
