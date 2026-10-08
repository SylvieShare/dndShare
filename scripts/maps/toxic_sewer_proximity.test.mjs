import test from "node:test";
import assert from "node:assert/strict";
import { proximitySample } from "./toxic_sewer_proximity.mjs";
import { addedSewerSurface } from "./toxic_sewer_reference.mjs";
test("complete bare-surface distance excludes old wood and marks raised new flesh", () => {
  const grid = {
    low: [0, 0, 0],
    stepMM: 1,
    size: [2, 2, 2],
    values: [0, 0, 0, 0, 1, 1, 1, 1],
    thresholdMM: 0.4,
  };
  assert.equal(proximitySample(grid, [0.2, 0.8, 0.6]), 0.6);
  assert.equal(addedSewerSurface([0.2, 0.8, 0.01], { proximity: grid }), false);
  assert.equal(addedSewerSurface([0.2, 0.8, 0.8], { proximity: grid }), true);
  assert.equal(proximitySample(grid, [2, 0, 0]), null);
});
