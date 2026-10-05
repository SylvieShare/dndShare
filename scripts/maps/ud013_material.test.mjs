import { test } from "node:test";
import assert from "node:assert/strict";
import { makeSkullPainter, skullPartAt } from "./ud013_material.mjs";
test("both walls and plinth stay stone even next to the skull pile", () => {
  for (const p of [
    [14, 0, 25],
    [0, 14, 25],
    [0, 0, 12],
  ])
    assert.equal(skullPartAt(...p), "stone");
  assert.equal(skullPartAt(0, 0, 25), "bone");
});
test("low bones use the measured floor height instead of a global height cut", () => {
  assert.equal(skullPartAt(0, 0, 14.8, 14.5), "stone");
  assert.equal(skullPartAt(0, 0, 14.8, 13.6), "bone");
});
test("incorrect bone-coloured wall is repaired and bones retain aged ivory", () => {
  const paint = makeSkullPainter({
    size: 2,
    step: 35,
    min: -17.5,
    heights: [13.7, 13.7, 13.7, 13.7],
  });
  const wall = paint([201, 184, 133], [0, 14, 25], [0, 1, 0]),
    skull = paint([137, 130, 115], [0, 0, 25], [0, 0, 1]);
  assert.ok(wall.rgb[0] < wall.rgb[1] && wall.rgb[1] <= wall.rgb[2]);
  assert.ok(skull.rgb[0] > skull.rgb[1] && skull.rgb[1] > skull.rgb[2]);
  assert.ok(skull.rgb.every((v) => Number.isFinite(v) && v > 4 && v < 255));
  assert.ok(skull.roughness < wall.roughness);
});
