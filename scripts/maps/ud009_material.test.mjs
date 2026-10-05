import { test } from "node:test";
import assert from "node:assert/strict";
import { debrisPartAt, paintDebrisPixel } from "./ud009_material.mjs";
test("the plinth, floor, intact wall and loose debris remain distinct", () => {
  assert.equal(debrisPartAt(0, 0, 10), "base");
  assert.equal(debrisPartAt(-10, 0, 14.5), "floor");
  assert.equal(debrisPartAt(14, 0, 28), "wall");
  assert.equal(debrisPartAt(0, 0, 28), "rubble");
});
test("cool grey rubble gets subtle dust on upward surfaces rather than side faces", () => {
  const rgb = [137, 130, 115],
    p = [0, 0, 28];
  const side = paintDebrisPixel(rgb, p, [1, 0, 0]),
    top = paintDebrisPixel(rgb, p, [0, 0, 1]);
  assert.ok(
    top.rgb.reduce((a, b) => a + b, 0) > side.rgb.reduce((a, b) => a + b, 0),
  );
  assert.ok(side.rgb[0] < side.rgb[1] && side.rgb[1] <= side.rgb[2]);
  assert.ok(top.roughness >= side.roughness);
});
test("grain is continuous in model space and never produces black or metallic stone", () => {
  const a = paintDebrisPixel([137, 130, 115], [1, 2, 28], [0, 0, 1]),
    b = paintDebrisPixel([137, 130, 115], [1.001, 2.001, 28.001], [0, 0, 1]);
  a.rgb.forEach((v, i) => assert.ok(Math.abs(v - b.rgb[i]) <= 1));
  assert.ok(a.rgb.every((v) => Number.isFinite(v) && v > 4 && v < 255));
  assert.ok(a.roughness >= 0.82 && a.roughness <= 0.97);
  assert.equal(a.metallic, undefined);
});
