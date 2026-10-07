import test from "node:test";
import assert from "node:assert/strict";
import { wagonReferenceDistance } from "./lost_cave_wagon_reference.mjs";
test("wagon reference uses upright3D distance and never matches points outside the sculpt grid", () => {
  const r = {
    spec: { low: [0, 0, 0], step: 0.25, size: [2, 2, 2], scale: 255 },
    data: Buffer.from([0, 20, 40, 60, 80, 100, 120, 255]),
  };
  assert.equal(wagonReferenceDistance([0, 0, 0], r), 0);
  assert.equal(wagonReferenceDistance([0.25, 0.25, 0.25], r), 1);
  assert.equal(wagonReferenceDistance([0, 0, 2], r), Infinity);
});
