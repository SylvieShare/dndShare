import test from "node:test";
import assert from "node:assert/strict";
import specs from "./lost-cave-recipes.json" with { type: "json" };
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
