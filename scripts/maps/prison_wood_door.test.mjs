import test from "node:test";
import assert from "node:assert/strict";
import specs from "./ultimate-bonus.json" with { type: "json" };
import {
  woodenGrillePartAt,
  makeWoodenGrillePainter,
} from "./prison_wood_door.mjs";
test("measured timber faces and pointed tips remain wood between warped iron straps", () => {
  const s = specs["UD-098"];
  for (const p of [
    [13.2258, 4.8819, 63.8481],
    [15.6, -6.42, 63.8],
    [13.2277, 14.6292, 62.6135],
    [13.6, -16.5, 73.5],
  ])
    assert.equal(woodenGrillePartAt(p, s), "wood");
  for (const p of [
    [12.5608, 5.6883, 34.4951],
    [16.5, 5, 34],
    [14.4, 14.4, 53.9],
    [12.6993, 5.8857, 41.8543],
  ])
    assert.equal(woodenGrillePartAt(p, s), "iron");
});
test("soil and mounting stone do not become metal; low strap gets the iron finish", () => {
  const paint = makeWoodenGrillePainter(specs["UD-098"]);
  for (const [p, part] of [
    [[0, 0, 14.4], "soil"],
    [[-9.2258, 9.2348, 13.1022], "soil"],
    [[0, 0, 11], "stone"],
    [[12.6, 0, 14.4], "iron"],
  ])
    assert.equal(paint([137, 130, 115], p, [0, 0, 1]).part, part);
  assert.equal(
    paint([137, 130, 115], [13.2258, 4.8819, 63.8481], [-1, 0, 0]).metallic,
    0,
  );
  assert.ok(paint([137, 130, 115], [12.6, 0, 14.4], [-1, 0, 0]).metallic > 0.6);
});
test("all four measured pointed stock profiles stay wood across their complete width", () => {
  const s = specs["UD-098"];
  for (const y of [-16.9, -14.2, -6.8, -3.8, 4.2, 7.1, 14.2, 17.3])
    assert.equal(woodenGrillePartAt([14.4, y, 73], s), "wood");
});
test("bowed stock side faces between straps remain timber", () => {
  const s = specs["UD-098"];
  for (const p of [
    [14, -3.4, 60],
    [13.4, 13.9, 60],
    [14, 3.9, 47],
    [14, 7.5, 20],
  ])
    assert.equal(woodenGrillePartAt(p, s), "wood");
});
