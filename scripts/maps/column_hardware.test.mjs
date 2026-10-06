import test from "node:test";
import assert from "node:assert/strict";
import specs from "./ultimate-columns.json" with { type: "json" };
import { columnHardwarePartAt } from "./column_hardware.mjs";
const spec = specs["UD-085"],
  floor = { size: 2, min: -17.5, step: 35, heights: [14, 14, 14, 14] };
test("carved post faces and its top cut stay wood rather than becoming iron", () => {
  for (const p of [
    [-6.7227, -8.3399, 44.0277],
    [-9.1388, -6.3052, 43.4599],
    [-0.5092, 2.6761, 68.1068],
  ])
    assert.equal(columnHardwarePartAt(p, spec, floor), "wood");
});
test("both chains and asymmetrical pin ends stay iron", () => {
  for (const p of [
    [-11.3054, 0.1491, 36.2743],
    [8.7112, -1.46, 26.9697],
    [8.858, -1.1392, 47.6948],
    [8.3228, 3.0282, 68.8795],
    [8.2267, -7.0039, 67.8707],
    [7.9518, -6.6887, 58.6161],
    [-6.3962, 0.0352, 69.0213],
  ])
    assert.equal(columnHardwarePartAt(p, spec, floor), "iron");
});
test("ring openings and loose blocks remain stone", () => {
  assert.equal(
    columnHardwarePartAt([1.3178, 13.036, 14.2308], spec, floor),
    "stone",
  );
  assert.equal(
    columnHardwarePartAt([-6.4977, -13.3536, 14.0871], spec, floor),
    "stone",
  );
  assert.equal(columnHardwarePartAt([-13, 10, 18], spec, floor), "stone");
});
test("inner surfaces of rear chain links stay iron while timber visible through a loop stays wood", () => {
  assert.equal(
    columnHardwarePartAt([8.3481, -2.1795, 44.7369], spec, floor),
    "iron",
  );
  assert.equal(
    columnHardwarePartAt([8.3204, -2.6701, 46.3735], spec, floor),
    "iron",
  );
  assert.equal(
    columnHardwarePartAt([7.8388, -1.6304, 45.0835], spec, floor),
    "wood",
  );
});
test("square column chains remain iron while stones inside loops and both caps stay masonry", () => {
  const square = specs["UD-086"];
  for (const p of [
    [-10.7709, -11.3857, 53.7445],
    [-11.7137, 8.6424, 47.1762],
    [-13.047, -13.4418, 35.6952],
    [-11.6245, -12.9978, 68.2223],
  ])
    assert.equal(columnHardwarePartAt(p, square), "iron");
  for (const p of [
    [-10.6333, -7.8256, 36.6273],
    [-12.4737, -5.6989, 58.6628],
    [-12.6805, -14.3048, 72.5987],
    [12, 12, 33],
    [0, 0, 77],
  ])
    assert.equal(columnHardwarePartAt(p, square), "stone");
});
