import test from "node:test";
import assert from "node:assert/strict";
import { makeTablePainter, tablePartAt } from "./table_material.mjs";
import { barrelPartAt } from "./barrel_material.mjs";
import { woodFloorPartAt } from "./wood_floor_material.mjs";

test("low dish basins keep ceramic while the bare tabletop removes edge spill", () => {
  const p = [10, 10.05, 28.8];
  const bare = {
    spec: { low: p, step: 1, size: [1, 1, 1], scale: 255 },
    data: Buffer.from([0]),
  };
  const paint = makeTablePainter({ full: true }, bare);
  assert.equal(paint([160, 145, 115], p, [0, 0, 1]).part, "plate");
  const edge = [14.3, 10.05, 28.8];
  bare.spec.low = edge;
  assert.equal(paint([160, 145, 115], edge, [0, 0, 1]).part, "wood");
});

test("measured spoons are metal and floor chips outside the table feet stay stone", () => {
  for (const p of [
    [-13.6535, 5.3871, 28.6187],
    [2.3395, 7.8954, 28.2867],
    [-3.1215, -5.0892, 28.6194],
    [14.4318, -7.2066, 28.5668],
  ])
    assert.equal(tablePartAt(p), "iron");
  assert.equal(tablePartAt([0, 8, 15.6]), "stone");
  assert.equal(tablePartAt([13, 13, 15.6]), "wood");
});

test("bench front and broad legs stay wood while nearby paving stays stone", () => {
  for (const p of [
    [-7.2998, 6.7423, 19.3383],
    [7.3668, 7.9964, 18.2072],
  ])
    assert.equal(tablePartAt(p, false, true), "wood");
  assert.equal(tablePartAt([0, 0, 15.6], false, true), "stone");
});

test("barrel chain and hoops are metal but the lower support beam stays wood", () => {
  assert.equal(barrelPartAt([-2.3162, -3.5992, 37.9072]), "chain");
  assert.equal(barrelPartAt([-6.8726, 0.9287, 37.0188]), "hoop");
  assert.equal(barrelPartAt([-6.9, -12, 20]), "wood");
  assert.equal(barrelPartAt([10.4, 0, 30]), "stone");
});

test("the thin wooden floor uses its own datum and lower nails remain metal", () => {
  assert.equal(woodFloorPartAt([1.4353, 11.941, 10.2241]), "iron");
  assert.equal(woodFloorPartAt([-2.9743, -15.2343, 9.9354]), "iron");
  assert.equal(woodFloorPartAt([1.4353, 0.6109, 9.3764]), "wood");
  assert.equal(woodFloorPartAt([10.8187, 0.6147, 7.4969]), "stone");
});
