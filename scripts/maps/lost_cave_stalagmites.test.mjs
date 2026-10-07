import test from "node:test";
import assert from "node:assert/strict";
import specs from "./lost_cave_recipes.mjs";
import { calciteWeightAt, paintStalagmites } from "./lost_cave_stalagmites.mjs";
test("all seven measured deposits are separate from the surrounding floor", () => {
  const s = specs["LC-010"];
  assert.equal(s.stalagmites.length, 7);
  for (const c of s.stalagmites)
    assert.ok(calciteWeightAt([c.x, c.y, c.top - 0.5], s) > 0.9);
  for (const p of [
    [-0.003, 0.0168, 13.3991],
    [-9.343, 5.7605, 15.3461],
    [12.724, 9.3548, 14.3683],
  ])
    assert.equal(calciteWeightAt(p, s), 0);
});
test("calcite has a gradual dirty root and remains a nonmetallic mineral", () => {
  const s = specs["LC-010"],
    c = s.stalagmites[0];
  assert.equal(calciteWeightAt([c.x, c.y, c.base], s), 0);
  assert.ok(calciteWeightAt([c.x, c.y, c.base + 1.4], s) > 0.2);
  const value = paintStalagmites([c.x, c.y, c.top - 0.5], [0, 0, 1], 240, s);
  assert.equal(value.part, "calcite");
  assert.equal(value.metallic, 0);
  assert.equal(value.roughness, s.calcite.roughness);
});
test("tall LC-011 deposits include measured flared lower rings while low floor stays stone", () => {
  const s = specs["LC-011"];
  for (const p of [
    [-2.8582, 9.7058, 23.4038],
    [-3.3188, 8.4041, 20.2998],
    [-2.7598, 8.2602, 18.775],
    [1.694, 9.3541, 17.928],
  ])
    assert.ok(calciteWeightAt(p, s) > 0.6);
  for (const p of [
    [-2.6919, 7.8957, 15.7008],
    [-4.6417, 3.4732, 14.7281],
    [7.0341, 11.2928, 14.4973],
    [0, 0, 13.8012],
  ])
    assert.equal(calciteWeightAt(p, s), 0);
});
test("LC-012 includes tall tips and hanging rings while keeping the stone cap and end face", () => {
  const s = specs["LC-012"];
  for (const p of [
    [3.7534, -0.6781, 35.9886],
    [12.0319, 3.0771, 35.0712],
    [-4.4402, 6.0014, 29.8533],
    [-3.8952, -14.6476, 28.7477],
  ])
    assert.ok(calciteWeightAt(p, s) > 0.6);
  for (const p of [
    [1.269, -7.5538, 38.481],
    [0.2015, 4.9794, 38.4811],
    [1.5562, -17.2861, 23.9118],
    [16.442, -10.744, 14.7328],
  ])
    assert.equal(calciteWeightAt(p, s), 0);
});
