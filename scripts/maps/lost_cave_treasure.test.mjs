import test from "node:test";
import assert from "node:assert/strict";
import specs from "./lost_cave_recipes.mjs";
import {
  caveTreasurePartAt,
  paintCaveTreasure,
} from "./lost_cave_treasure.mjs";
const spec = specs["LC-063"];
const added = { distanceAt: () => 3 };
test("native wall and well rim stay stone while measured ring setting and loose clusters are jewels", () => {
  assert.equal(
    caveTreasurePartAt([-3.9786, 11.7621, 38.4799], spec, {
      distanceAt: () => 0.04,
    }).part,
    "rock",
  );
  for (const p of [
    [15.8078, -4, 20],
    [16.1363, 0, 20],
    [15.9681, 0, 22],
  ])
    assert.equal(caveTreasurePartAt(p, spec, added).part, "rock");
  for (const p of [
    [7.134, 0.3293, 27.1917],
    [3.1176, 7.8652, 29.0611],
    [10.7696, -13.5744, 16.5801],
    [11.6613, -12.7523, 17.1387],
    [12.9646, 12.1491, 16.6194],
  ])
    assert.equal(caveTreasurePartAt(p, spec, added).part, "gem");
  assert.equal(
    caveTreasurePartAt([16.1119, 2.8959, 23.5618], spec, added).part,
    "rock",
  );
  assert.equal(
    caveTreasurePartAt([15.9143, -10.3455, 14.1832], spec, {
      distanceAt: () => 0.09,
    }).part,
    "rock",
  );
  assert.equal(
    caveTreasurePartAt([9.4662, 4.7214, 26.1998], spec, added).part,
    "gold",
  );
  assert.throws(() => caveTreasurePartAt([9, 4, 26], spec));
});
test("gold is metallic, jewels and neighbouring cave stone retain distinct nonmetal surfaces", () => {
  const g = paintCaveTreasure(
    [9.4662, 4.7214, 26.1998],
    [0, 0, 1],
    240,
    spec,
    added,
  );
  assert(g.metallic > 0.65);
  assert(g.rgb[0] > g.rgb[2] * 2);
  const gem = paintCaveTreasure(
    [7.134, 0.3293, 27.1917],
    [0, 0, 1],
    240,
    spec,
    added,
  );
  assert.equal(gem.metallic, 0);
  assert(gem.rgb[1] > gem.rgb[0]);
  assert(gem.normalNeutral);
  const wall = paintCaveTreasure(
    [-3.9786, 11.7621, 38.4799],
    [0, 0, 1],
    240,
    spec,
    { distanceAt: () => 0.04 },
  );
  assert.equal(wall.metallic, 0);
  assert(!wall.normalNeutral);
});

test("depth-reviewed visible contours prevent a gem volume from colouring its neighbouring rim", () => {
  const view = () => undefined;
  view.isVisible = () => true;
  assert.equal(
    caveTreasurePartAt([13.239, 8.2925, 24.1982], spec, added, view).part,
    "rock",
  );
  const marked = () => ({ colour: [0.65, 0.16, 0.47] });
  marked.isVisible = () => true;
  assert.equal(
    caveTreasurePartAt([3.1176, 7.8652, 29.0611], spec, added, marked).part,
    "gem",
  );
  assert.equal(
    caveTreasurePartAt(
      [15.9143, -10.3455, 14.1832],
      spec,
      { distanceAt: () => 0.09 },
      marked,
    ).part,
    "rock",
  );
});
