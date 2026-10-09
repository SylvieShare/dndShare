import test from "node:test";
import assert from "node:assert/strict";
import { ropeAxisAt, paintCaveRope } from "./lost_cave_rope.mjs";
import specs from "./lost_cave_recipes.mjs";
test("rope fibre coordinates follow a measured bend and choose the nearest strand", () => {
  const paths = [
    [
      [0, 0, 0],
      [0, 0, 5],
      [3, 0, 5],
    ],
    [
      [10, 0, 0],
      [10, 0, 5],
    ],
  ];
  const a = ropeAxisAt([0.1, 0, 3], paths);
  assert.deepEqual(a.direction, [0, 0, 1]);
  assert.equal(a.along, 3);
  const b = ropeAxisAt([2, 0.1, 5], paths);
  assert.deepEqual(b.direction, [1, 0, 0]);
  assert.equal(b.along, 7);
  assert.equal(ropeAxisAt([10.1, 0, 2], paths).along, 2);
});
test("verified source silhouettes gate hemp independently of nearby stone and metal", () => {
  const s = specs["LC-067"],
    p = [9.7, 6.3, 22.6];
  const v = paintCaveRope(p, [0, 0, 1], 225, s, () => true);
  assert.equal(v.part, "rope");
  assert.equal(v.metallic, 0);
  assert(v.roughness > 0.75);
  assert(v.rgb[0] > v.rgb[2]);
  assert.equal(paintCaveRope(p, [0, 0, 1], 225, s, () => false).part, "rock");
  assert.equal(
    paintCaveRope([14.464, 12.012, 14.7383], [0, 0, 1], 225, s, () => true)
      .part,
    "rock",
  );
  assert.throws(() => paintCaveRope(p, [0, 0, 1], 225, s));
});
test("LC-068 native bare well protects stone caught inside a rope silhouette", () => {
  const s = specs["LC-068"],
    p = [10, 8, 24];
  assert.throws(() => paintCaveRope(p, [0, 0, 1], 225, s, () => true));
  assert.equal(
    paintCaveRope(p, [0, 0, 1], 225, s, () => true, { distanceAt: () => 0.05 })
      .part,
    "rock",
  );
  assert.equal(
    paintCaveRope(p, [0, 0, 1], 225, s, () => true, { distanceAt: () => 1.5 })
      .part,
    "rope",
  );
});
