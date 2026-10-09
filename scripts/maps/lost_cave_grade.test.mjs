import test from "node:test";
import assert from "node:assert/strict";
import {
  caveFloorHeightAt,
  darkenCaveFloorJoints,
} from "./lost_cave_surface.mjs";
import { calciteWeightAt } from "./lost_cave_stalagmites.mjs";
import specs from "./lost_cave_recipes.mjs";
test("raised bridge joints follow the local walking grade and exclude the tall mineral deposits", () => {
  const s = specs["LC-057"];
  assert.equal(caveFloorHeightAt([0, 0, 0], s), 21.2);
  assert.equal(caveFloorHeightAt([0, -70, 0], s), 14.735);
  const centre = darkenCaveFloorJoints({ rgb: [100, 80, 60] }, [0, 0, 20.2], s);
  const end = darkenCaveFloorJoints({ rgb: [100, 80, 60] }, [0, 52, 20.2], s);
  assert(centre.rgb.every((v, i) => v < end.rgb[i]));
  assert.equal(calciteWeightAt([0, 0, 21.1359], s), 0);
  assert(calciteWeightAt([12.3935, -20.6631, 48.0777], s) > 0.9);
});
