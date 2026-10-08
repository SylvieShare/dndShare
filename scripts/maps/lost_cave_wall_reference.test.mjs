import test from "node:test";
import assert from "node:assert/strict";
import { wallReferenceDistance } from "./lost_cave_wall_reference.mjs";
test("wall reference interpolates measured distances in millimetres and excludes outside points", () => {
  const data = Buffer.alloc(16);
  for (let i = 0; i < 8; i++) data.writeUInt16LE(i * 4096, i * 2);
  const field = {
    spec: { low: [0, 0, 0], step: 0.25, size: [2, 2, 2], scale: 4096 },
    data,
  };
  assert.equal(wallReferenceDistance([0, 0, 0], field), 0);
  assert.equal(wallReferenceDistance([0.25, 0.25, 0.25], field), 7);
  assert.equal(wallReferenceDistance([0.125, 0.125, 0.125], field), 3.5);
  assert.equal(wallReferenceDistance([0.0625, 0, 0], field), 0.25);
  assert.equal(wallReferenceDistance([-0.001, 0, 0], field), Infinity);
  assert.equal(wallReferenceDistance([0, 0, 0.251], field), Infinity);
});
