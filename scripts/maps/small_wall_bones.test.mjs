import test from "node:test";
import assert from "node:assert/strict";
import specs from "./ultimate-small-walls.json" with { type: "json" };
import { makeAddedBonePainter } from "./added_bones.mjs";
// A zero-distance reference represents a different bare cobble intersecting a bone.
const bare = {
  spec: { low: [-20, -20, 0], step: 50, size: [2, 2, 2], scale: 255 },
  data: new Uint8Array(8),
};
const partAt = (code, p) =>
  makeAddedBonePainter(bare, specs[code])([137, 130, 115], p, [0, 0, 1], 255)
    .part;
test("direct floor bone regions survive a different bare cobble layout", () => {
  assert.equal(partAt("UD-069", [-14.28, 3.19, 14.1721]), "bone");
  assert.equal(partAt("UD-069", [-13.77, -8.2, 13.9]), "bone");
  assert.equal(partAt("UD-069", [-10, 3, 14.2]), "stone");
  assert.equal(partAt("UD-070", [-1.23, -14.86, 14.1]), "bone");
});
test("corner skulls retain ivory while their stone platforms and side wall stay grey", () => {
  assert.equal(partAt("UD-071", [-14.3581, 14.1429, 23.1204]), "bone");
  assert.equal(partAt("UD-071", [4.1034, 13.9289, 27.5423]), "bone");
  assert.equal(partAt("UD-071", [13.3341, 3.6699, 28.7843]), "bone");
  assert.equal(partAt("UD-071", [-14.8111, 11.2121, 18.7144]), "stone");
  assert.equal(partAt("UD-071", [2.3843, 10.8971, 23.3578]), "stone");
  assert.equal(partAt("UD-071", [0, 14, 20]), "stone");
});
