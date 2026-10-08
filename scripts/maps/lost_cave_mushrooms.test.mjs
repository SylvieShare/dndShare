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

test("porous blue cap and orange radial disc retain their own material boundaries", () => {
  const s = specs["LC-051"];
  for (const p of [
    [-13.1843, -5.1004, 47.1155],
    [-8.2436, -4.0108, 54.4181],
    [-4.0785, -9.3632, 37.3682],
  ])
    assert.equal(mushroomPartAt(p, [0, 0, 1], s), "blue");
  assert.equal(
    mushroomPartAt([-8.7722, -9.2273, 33.0795], [0, 0, 1], s),
    "stalk",
  );
  assert.equal(
    mushroomPartAt([13.0864, -5.556, 31.6637], [0, 0, 1], s),
    "disc",
  );
  assert.equal(
    mushroomPartAt([7.0932, 2.742, 25.7162], [0, 0, 1], s),
    "disc-centre",
  );
  const lower = paintMushrooms([-7, -2, 38], [0, 0, 1], 240, s),
    upper = paintMushrooms([-7, -2, 54], [0, 0, 1], 240, s);
  assert(lower.rgb[1] > upper.rgb[1] && upper.rgb[0] > lower.rgb[0]);
  assert.equal(lower.metallic, 0);
});

test("spiral bowl stays orange while the lower red cap and its ivory spots remain distinct", () => {
  const s = specs["LC-052"];
  assert.equal(mushroomPartAt([7.6219, 9.4506, 44.1042], [0, 0, 1], s), "bowl");
  assert.equal(
    mushroomPartAt([-17.1787, -6.3229, 28.4245], [1, 0, 0], s),
    "cap",
  );
  assert.equal(
    mushroomPartAt([-9.7206, -7.3057, 33.7469], [0, 0, 1], s),
    "wart",
  );
  assert.equal(
    mushroomPartAt([5.7909, -1.7531, 24.3216], [1, 0, 0], s),
    "stalk",
  );
  assert.equal(
    mushroomPartAt([-5.3681, -12.6391, 19.6828], [0, 0, 1], s),
    "bud",
  );
  assert.equal(
    mushroomPartAt([-12.7308, -11.2194, 17.3726], [0, 0, 1], s),
    "bud",
  );
});

test("mushroom wall keeps structural stone separate from green shelves and red buds", () => {
  const s = specs["LC-053"],
    far = { distanceAt: () => 5 };
  assert.equal(
    mushroomPartAt([3.7506, 7.4986, 32.0429], [0, 0, 1], s, undefined, {
      distanceAt: () => 0.1895,
    }),
    "rock",
  );
  assert.equal(
    mushroomPartAt([5.5591, 6.4858, 21.6844], [0, 0, 1], s, undefined, far),
    "shelf-green",
  );
  assert.equal(
    mushroomPartAt([6.7362, 6.6416, 33.3341], [0, 0, 1], s, undefined, far),
    "shelf",
  );
  assert.equal(
    mushroomPartAt([13.2899, -1.9403, 16.7321], [0, 0, 1], s, undefined, far),
    "bud",
  );
  assert.equal(
    mushroomPartAt([15.4598, -5.9652, 36.7521], [0, 0, 1], s, undefined, far),
    "wart",
  );
});

test("porous orange wall fungus stays separate from its red neighbour and bare wall", () => {
  const s = specs["LC-054"],
    far = { distanceAt: () => 6 };
  assert.equal(
    mushroomPartAt([11.8661, -2.0258, 32.9293], [1, 0, 0], s, undefined, far),
    "honeycomb",
  );
  assert.equal(
    mushroomPartAt([11.5782, -0.5674, 20.0908], [1, 0, 0], s, undefined, far),
    "honeycomb",
  );
  assert.equal(
    mushroomPartAt([-0.2125, -3.0434, 33.5859], [0, 0, 1], s, undefined, {
      distanceAt: () => 0.0726,
    }),
    "rock",
  );
  assert.equal(
    mushroomPartAt([7.5944, 10.5729, 31.4596], [0, 0, 1], s, undefined, far),
    "cap",
  );
  const value = paintMushrooms(
    [11.8661, -2.0258, 32.9293],
    [1, 0, 0],
    220,
    s,
    undefined,
    far,
  );
  assert(value.rgb[0] > value.rgb[1] && value.rgb[1] > value.rgb[2]);
  assert.equal(value.metallic, 0);
});
