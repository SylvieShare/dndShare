import test from "node:test";
import assert from "node:assert/strict";
import specs from "./lost_cave_recipes.mjs";
import { railwayPartAt, paintRailway } from "./lost_cave_railway.mjs";
const spec = specs["LC-018"];
test("measured rails and bolt heads are iron, ties are timber, rubble stays rock", () => {
  for (const p of [
    [-8.2591, 13.3039, 14.1181],
    [-5.7308, 7.3555, 10.5471],
    [-12.7539, 10.3889, 10.8456],
    [11.9111, -0.2303, 10.9748],
  ])
    assert.equal(railwayPartAt(p, spec), "iron");
  for (const p of [
    [-0.0562, 12.0767, 9.7218],
    [0.6742, -1.52, 9.7119],
    [0.0562, -9.4983, 9.7492],
  ])
    assert.equal(railwayPartAt(p, spec), "wood");
  for (const p of [
    [-1.0675, 5.112, 8.6042],
    [-0.7866, -5.1133, 8.4326],
  ])
    assert.equal(railwayPartAt(p, spec), "rock");
});
test("iron has a metallic response while timber and cave stone remain nonmetallic", () => {
  assert.ok(
    paintRailway([-8.2591, 13.3039, 14.1181], [0, 0, 1], 255, spec).metallic >
      0.4,
  );
  for (const p of [
    [-0.0562, 12.0767, 9.7218],
    [-1.0675, 5.112, 8.6042],
  ])
    assert.equal(paintRailway(p, [0, 0, 1], 220, spec).metallic, 0);
});
test("measured lower rail ends and bolt side faces remain iron", () => {
  for (const p of [
    [-9.6259, -17.4896, 8.7749],
    [13.4433, 1.4777, 9.7166],
    [13.3721, 10.5781, 10.4918],
  ])
    assert.equal(railwayPartAt(p, spec), "iron");
  assert.equal(railwayPartAt([-9.0263, -17.1703, 6.2227], spec), "rock");
});
test("LC-019 separates bent rail fragments and broken timber from the gap", () => {
  const s = specs["LC-019"];
  for (const p of [
    [-10.283, 7.4084, 13.9606],
    [8.3725, 4.145, 16.0589],
    [8.4849, -7.8198, 14.059],
    [-13.3174, 2.0763, 10.8815],
  ])
    assert.equal(railwayPartAt(p, s), "iron");
  for (const p of [
    [-10.7326, 2.3042, 9.3391],
    [-3.4277, -1.1804, 9.6947],
    [7.5297, -1.2365, 9.6756],
    [-0.1124, -12.1384, 10.0413],
  ])
    assert.equal(railwayPartAt(p, s), "wood");
  for (const p of [
    [-0.0562, 0.0023, 8.3916],
    [-0.0562, 5.0572, 9.5606],
    [0, -5.3904, 7.5474],
    [8.9382, 2.648, 8.7196],
    [9.1845, 2.6076, 9.5365],
  ])
    assert.equal(railwayPartAt(p, s), "rock");
});
test("LC-020 follows concentric arcs and radial timber while leaving gaps stone", () => {
  const s = specs["LC-020"];
  for (const p of [
    [-7.9241, -14.961, 14.1187],
    [-0.1124, -2.1403, 10.5679],
    [15.3425, 7.5189, 14.1123],
    [10.0035, -15.3541, 13.9595],
  ])
    assert.equal(railwayPartAt(p, s), "iron");
  for (const p of [
    [1.2926, -11.5808, 10.0419],
    [7.1935, -5.3989, 10.0419],
    [13.3755, 2.0757, 10.0397],
  ])
    assert.equal(railwayPartAt(p, s), "wood");
  for (const p of [
    [0.1124, -7.474, 7.9387],
    [9.1043, -0.2255, 8.5604],
  ])
    assert.equal(railwayPartAt(p, s), "rock");
});
