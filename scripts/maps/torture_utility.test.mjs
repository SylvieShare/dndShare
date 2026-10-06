import test from "node:test";
import assert from "node:assert/strict";
import torture from "./ultimate-torture.json" with { type: "json" };
import utility from "./ultimate-utility.json" with { type: "json" };
import weapons from "./ultimate-weapons.json" with { type: "json" };
import { tortureCagePartAt } from "./torture_material.mjs";
import { rackPartAt } from "./rack_material.mjs";
import { chairPartAt } from "./chair_material.mjs";
import { woodenTrapPartAt } from "./wooden_trap_material.mjs";
import { utilityPartAt } from "./utility_material.mjs";
import { weaponsPartAt } from "./weapons_material.mjs";
import { individualPainter } from "./individual_painter.mjs";

test("cage distinguishes the low skeleton, bars and rear wall", () => {
  assert.equal(tortureCagePartAt([-2, 0, 19]), "bone");
  assert.equal(tortureCagePartAt([-12, 0, 34]), "iron");
  assert.equal(tortureCagePartAt([14, 0, 34]), "stone");
});
test("rack skulls stay ivory and the crosswise roller stays wooden", () => {
  const spec = torture["UD-061"];
  for (const h of spec.heads) assert.equal(rackPartAt(h.centre, spec), "bone");
  assert.equal(rackPartAt([22.5, 0, 32], spec), "roller");
  assert.equal(rackPartAt([0, 0, 24], spec), "wood");
  assert.equal(rackPartAt([21.73, 5.51, 35.6], spec), "iron");
});
test("chair platform and femurs retain their materials below the iron seat", () => {
  const spec = torture["UD-062"];
  assert.equal(chairPartAt([0, 0, 16], spec), "wood");
  assert.equal(chairPartAt([-3.83, 14.2, 15.35], spec), "bone");
  assert.equal(chairPartAt([0, 0, 26], spec), "iron");
  assert.equal(chairPartAt([13, 0, 30], spec), "stone");
});
test("high wooden trap tips do not leave grey patches or colour the flat wall", () => {
  const spec = torture["UD-063"];
  assert.equal(
    woodenTrapPartAt([10.4, 0, 36.09], spec, [-0.682, 0.27, 0.679]),
    "wood",
  );
  assert.equal(woodenTrapPartAt([10.4, 0, 34], spec, [-1, 0, 0]), "stone");
  assert.equal(woodenTrapPartAt([2.24, 5.69, 26.7], spec), "iron");
});
test("grate slots remain stone and aligned poison excludes the iron frame", () => {
  assert.equal(utilityPartAt([0, 0, 13.139], utility["UD-064"]), "stone");
  assert.equal(utilityPartAt([0, 0, 14.65], utility["UD-064"]), "iron");
  const bare = {
    spec: { low: [0, 0, 6.9], step: 1, size: [1, 1, 2], scale: 255 },
    data: Uint8Array.of(0, 255),
  };
  assert.equal(utilityPartAt([0, 0, 6.9], utility["UD-065"], bare), "iron");
  assert.equal(utilityPartAt([0, 0, 7.9], utility["UD-065"], bare), "toxic");
});
test("low pit floor stays stone and the factory requires wood instead of iron", async () => {
  const spec = utility["UD-067"];
  assert.equal(utilityPartAt([-0.25, 4.4, 5.2118], spec), "stone");
  assert.equal(utilityPartAt([-0.25, 4.4, 13.479], spec), "wood");
  const { parts } = await individualPainter({
    code: "UD-067",
    spec,
    model: {},
  });
  assert.deepEqual(parts, ["stone", "wood"]);
});
test("weapons separate rope, blades, hafts and the masonry between them", () => {
  const spec = weapons["UD-068"];
  assert.equal(weaponsPartAt([8.1624, 8.8158, 26.9253], spec), "rope");
  assert.equal(weaponsPartAt([9.9856, 10.794, 38.9808], spec), "iron");
  assert.equal(weaponsPartAt([10.5176, 10.3125, 18.3194], spec), "shaft");
  assert.equal(weaponsPartAt([10.6376, 8.0041, 18.2074], spec), "stone");
});
