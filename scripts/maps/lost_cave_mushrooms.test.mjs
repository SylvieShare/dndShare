import test from "node:test";
import assert from "node:assert/strict";
import { mushroomPartAt, paintMushrooms } from "./lost_cave_mushrooms.mjs";
import specs from "./lost_cave_recipes.mjs";
test("mushroom floor separates sculpted white warts, red skin, stalk, shelf, buds and bare slabs", () => {
  const s = specs["LC-050"];
  assert.equal(
    mushroomPartAt([-10.056, 11.6257, 33.6508], [0, 0, 1], s),
    "wart",
  );
  assert.equal(
    mushroomPartAt([-13.2262, 4.7916, 32.1019], [0, 0, 1], s),
    "cap",
  );
  assert.equal(
    mushroomPartAt([-12.3585, 6.5855, 23.6692], [1, 0, 0], s),
    "stalk",
  );
  assert.equal(
    mushroomPartAt([11.946, 9.4407, 17.2913], [0, 0, 1], s),
    "shelf",
  );
  assert.equal(mushroomPartAt([10.7606, 4.6146, 16.5169], [0, 0, 1], s), "bud");
  assert.equal(mushroomPartAt([7.558, -5.629, 14.2517], [0, 0, 1], s), "rock");
  assert.equal(
    mushroomPartAt([4.4832, 12.6299, 15.4133], [-0.5395, -0.5232, 0.6597], s),
    "bud",
  );
  assert.equal(
    mushroomPartAt([8.8801, 8.9703, 15.2739], [0.0498, -0.5349, 0.8434], s),
    "stalk",
  );
  const cap = paintMushrooms([-13.2262, 4.7916, 32.1019], [0, 0, 1], 240, s);
  const stalk = paintMushrooms([-12.3585, 6.5855, 23.6692], [1, 0, 0], 240, s);
  assert(cap.rgb[0] > cap.rgb[1] * 2 && cap.metallic === 0);
  assert(stalk.roughness > cap.roughness && stalk.metallic === 0);
});
