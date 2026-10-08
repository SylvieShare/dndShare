import test from "node:test";
import assert from "node:assert/strict";
import specs from "./lost_cave_recipes.mjs";
import {
  boulderGroundPartAt,
  paintBoulderGround,
} from "./lost_cave_boulder_ground.mjs";
test("ground boulders remain distinct from flat slabs and low foundation", () => {
  const s = specs["LC-032"];
  assert.equal(
    boulderGroundPartAt([-11.9108, 11.7247, 20.3818], [0, 0, 1], s),
    "boulder",
  );
  assert.equal(
    boulderGroundPartAt([-10.5062, -3.602, 14.7473], [0, 0, 1], s),
    "rock",
  );
  assert.equal(
    boulderGroundPartAt([-11.9, 11.7, 14.6], [1, 0, 0], s),
    "boulder",
  );
  assert.equal(boulderGroundPartAt([-11.9, 11.7, 14.6], [0, 0, 1], s), "rock");
  assert.equal(boulderGroundPartAt([-11.9, 11.7, 12], [1, 0, 0], s), "rock");
  const boulder = paintBoulderGround(
    [-11.9108, 11.7247, 20.3818],
    [0, 0, 1],
    230,
    s,
  );
  assert.equal(boulder.metallic, 0);
  assert.ok(boulder.rgb[1] > boulder.rgb[0]);
});
