import { test } from "node:test";
import assert from "node:assert/strict";
import { majesticModel } from "./majestic_model.mjs";
const info = {
  collection: "majestic-highlands",
  collectionName: "Majestic Highlands XL",
  code: "MH-078",
  sourceName: "Overhang",
  footprintReviewed: true,
  width: 7,
  height: 7,
  mountDepth: 0.28,
  surfaceHeight: 0.42,
  maxHeight: 2,
  placementPoints: [{ x: 0.5, y: 0.5, elevation: 0.42 }],
  recipe: {
    width: 1,
    height: 1,
    tileType: "floor",
    hasDecor: true,
    tags: ["xl"],
    supportSlots: [{ x: 0, y: 0, width: 1, height: 1, elevation: 1.2 }],
  },
};
test("requires an individually reviewed footprint before building catalogue metadata", () => {
  assert.throws(
    () => majesticModel({ ...info, footprintReviewed: false }),
    /Reviewed footprint/,
  );
  assert.throws(
    () => majesticModel({ ...info, recipe: null }),
    /material recipe/,
  );
});
test("uses measured base cells despite decorative bounds and keeps physical heights and slots", () => {
  const m = majesticModel(info);
  assert.deepEqual([m.width, m.height], [1, 1]);
  assert.deepEqual(
    [m.mountDepth, m.surfaceHeight, m.maxHeight],
    [0.28, 0.42, 2],
  );
  assert.deepEqual(m.placementPoints, info.placementPoints);
  assert.deepEqual(m.supportSlots, info.recipe.supportSlots);
  assert.equal(m.sourceCode, "MH-078");
  assert.equal(m.sourceName, "Overhang");
});
