import test from "node:test";
import assert from "node:assert/strict";
import specs from "./lost_cave_recipes.mjs";
import {
  boulderGroundPartAt,
  paintBoulderGround,
} from "./lost_cave_boulder_ground.mjs";
test("LC-084 warm debris preserves its flat floor and blends the low stone root without a normal threshold colour seam", () => {
  const s = specs["LC-084"];
  assert.equal(
    boulderGroundPartAt([-13.4632, -14.4544, 14.748], [0, 0, 1], s),
    "rock",
  );
  const p = paintBoulderGround(
    [6.6047, -6.64, 37.5618],
    [0.2945, -0.7648, 0.5731],
    230,
    s,
  );
  assert.equal(p.part, "boulder");
  assert(p.rgb[0] > p.rgb[1] && p.rgb[1] > p.rgb[2]);
  assert.equal(p.metallic, 0);
  const a = paintBoulderGround([0, 0, 14.9], [0.46, 0, 0.89], 230, s),
    b = paintBoulderGround([0, 0, 14.9], [0.415, 0, 0.91], 230, s);
  assert(Math.max(...a.rgb.map((v, i) => Math.abs(v - b.rgb[i]))) < 5);
});
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
test("broken wall retains brown structural ends and fractures beside green rubble", () => {
  const s = specs["LC-035"];
  for (const p of [
    [-1.1807, 14.5496, 38.4802],
    [-2.2225, -12.3297, 38.9962],
    [-0.0695, 7.0745, 25.6643],
    [-6.6675, 1.3947, 18.064],
  ])
    assert.equal(boulderGroundPartAt(p, [0, 0, 1], s), "rock");
  for (const p of [
    [11.043, 10.0696, 21.3837],
    [8.8899, 6.4547, 23.0598],
    [5.7646, -6.0409, 20.0765],
    [13.8211, 1.3288, 16.2671],
    [10.3824, 4.9044, 18.4339],
    [7.8963, -9.6924, 20.7403],
    [7.3131, 7.5851, 27.6257],
  ])
    assert.equal(boulderGroundPartAt(p, [0, 0, 1], s), "boulder");
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
