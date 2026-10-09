import test from "node:test";
import assert from "node:assert/strict";
import specs from "./lost_cave_recipes.mjs";
import { caveWaterAt, paintCaveWater } from "./lost_cave_water.mjs";
const s = specs["LC-064"];
test("only the measured upward water inset is liquid, not the rim or neighbouring cliff", () => {
  for (const p of [
    [0.3442, -0.1246, 22.9775],
    [1.0385, 2.1107, 22.9773],
    [1.6136, 3.6798, 22.9771],
    [6.0363, 2.1898, 22.9759],
    [6.7223, -2.6118, 22.9758],
    [9.1231, -0.554, 22.9759],
    [12.2098, 1.1609, 22.9759],
    [11.1123, -5.6986, 22.9759],
  ])
    assert(caveWaterAt(p, [0, 0, 1], s));
  for (const [p, n] of [
    [
      [7.6826, 8.3598, 24.7136],
      [0.1153, -0.7531, 0.6477],
    ],
    [
      [6.4479, -9.7488, 24.5494],
      [0.0065, 0.9568, 0.2905],
    ],
    [
      [12.8958, -5.0131, 23.2329],
      [-0.752, 0.3557, 0.555],
    ],
    [
      [-3, 4, 22.9759],
      [1, 0, 0],
    ],
    [
      [-12, -1, 22.9759],
      [0, 0, 1],
    ],
  ])
    assert.equal(caveWaterAt(p, n, s), undefined);
  assert(
    caveWaterAt([9.1231, -0.554, 22.9759], [0.5, 0, 0.866], s),
    "Smoothed water border stays liquid",
  );
  const v = paintCaveWater([9.1231, -0.554, 22.9759], [0, 0, 1], 240, s);
  assert.equal(v.part, "water");
  assert.equal(v.metallic, 0);
  assert(v.roughness < 0.2);
  assert(v.rgb[1] > v.rgb[0] * 3);
  assert(v.normalNeutral);
});

test("the two LC-065 cups use their own elevations and leave their rims dry", () => {
  const s = specs["LC-065"];
  for (const p of [
    [3.5322, 6.7896, 30.0137],
    [11.2033, 9.1146, 30.0136],
    [5.8164, -8.0495, 20.6945],
    [11.9274, -6.9648, 20.6944],
  ])
    assert(caveWaterAt(p, [0, 0, 1], s));
  for (const p of [
    [12.2846, 0.7664, 31.9039],
    [14.9853, -7.859, 22.4455],
    [8.2562, -4.8385, 21.1733],
    [11, 9, 20.6944],
    [8, -8, 30.0136],
  ])
    assert.equal(caveWaterAt(p, [0, 0, 1], s), undefined);
});

test("LC-066 fills its measured basin without painting the outer ring", () => {
  const s = specs["LC-066"];
  for (const p of [
    [-2.0327, -3.853, 20.8773],
    [-0.8839, 0.7704, 20.8773],
    [3.6247, 0.1171, 20.8773],
    [5.3827, 9.8917, 20.8774],
  ])
    assert(caveWaterAt(p, [0, 0, 1], s));
  for (const p of [
    [9.9802, -6.6896, 24.7559],
    [6.3687, -12.8904, 24.6004],
    [10.6534, -5.888, 19.001],
    [12, 0, 20.8773],
  ])
    assert.equal(caveWaterAt(p, [0, 0, 1], s), undefined);
});
