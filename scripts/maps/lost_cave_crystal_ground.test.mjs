import test from "node:test";
import assert from "node:assert/strict";
import specs from "./lost_cave_recipes.mjs";
import {
  crystalGroundPartAt,
  paintCrystalGround,
} from "./lost_cave_crystal_ground.mjs";
test("crystal floor separates three source clusters from free brown slabs and low mounting", () => {
  const s = specs["LC-036"];
  for (const p of [
    [-10.8876, 9.0948, 37.0471],
    [-13.3897, -11.9626, 16.3889],
    [13.3221, 13.3308, 15.5905],
    [-12.9171, -1.9514, 25.304],
    [-14.3193, -14.9062, 16.2383],
  ])
    assert.equal(crystalGroundPartAt(p, s), "crystal");
  assert.equal(crystalGroundPartAt([3.7194, -4.7231, 14.6005], s), "rock");
  assert.equal(crystalGroundPartAt([-11.5, 9, 12], s), "rock");
  const gem = paintCrystalGround(
    [-10.8876, 9.0948, 37.0471],
    [0, 0, 1],
    230,
    s,
  );
  assert.equal(gem.metallic, 0);
  assert.ok(gem.rgb[2] > gem.rgb[1] && gem.rgb[1] > gem.rgb[0]);
  const crust = paintCrystalGround(
    [-11.5, 9, s.floorHeightMM],
    [0, 0, 1],
    230,
    s,
  );
  assert.equal(crust.part, "crust");
  assert.ok(crust.roughness > 0.9);
  assert.equal(
    paintCrystalGround([3.7194, -4.7231, 14.6005], [0, 0, 1], 230, s).part,
    "rock",
  );
});
