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
test("pit stones are colored independently of the low cavity and brown walls", () => {
  const s = specs["LC-034"];
  for (const p of [
    [-9.0446, -6.2381, 11.4255],
    [-5.8986, -7.1278, 6.8582],
    [8.2019, -0.9443, 4.8783],
    [3.483, -5.7139, 2.1537],
  ])
    assert.equal(boulderGroundPartAt(p, [0, 0, 1], s), "boulder");
  assert.equal(boulderGroundPartAt([0, 0, 0], [0, 0, -1], s), "rock");
  assert.equal(
    boulderGroundPartAt([-10.1681, -1.0626, 7.8297], [0.84, -0.34, 0.41], s),
    "rock",
  );
  assert.equal(
    boulderGroundPartAt([0.0562, -12.4241, 14.601], [0, 0, 1], s),
    "rock",
  );
});
