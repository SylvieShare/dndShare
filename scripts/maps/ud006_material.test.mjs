import { test } from "node:test";
import assert from "node:assert/strict";
import {
  timberPartAt,
  timberGrain,
  paintTimberPixel,
} from "./ud006_material.mjs";
test("all three timber components follow their measured geometry", () => {
  assert.equal(timberPartAt(14, 14, 30), "post");
  assert.equal(timberPartAt(6, 14, 21), "brace");
  assert.equal(timberPartAt(8, 12.5, 19), "brace");
  assert.equal(timberPartAt(-3, 14, 16), "foot");
  assert.equal(timberPartAt(4, 12, 13.6), "foot");
  for (const p of [
    [14, 0, 36],
    [0, 0, 14.8],
    [14, 14, 13],
    [14, -12, 35],
  ])
    assert.equal(timberPartAt(...p), "stone");
});
test("the erroneously brown top bricks are restored to cool masonry", () => {
  const paint = paintTimberPixel([99, 56, 27], [14, 0, 36], [0, -1, 0]);
  assert.equal(paint.part, "stone");
  assert.ok(paint.rgb[0] < paint.rgb[1] && paint.rgb[1] <= paint.rgb[2]);
  assert.equal(paint.roughness, 0.9);
});
test("wood grain runs vertically on the post and along the two supports", () => {
  const n = [0, -1, 0];
  const post = timberGrain("post", [13, 14, 30], n);
  assert.ok(Math.abs(post - timberGrain("post", [13, 14, 30.1], n)) < 0.015);
  assert.ok(Math.abs(post - timberGrain("post", [13.3, 14, 30], n)) > 0.01);
  const brace = timberGrain("brace", [6, 14, 21], n);
  assert.ok(Math.abs(brace - timberGrain("brace", [6.1, 14, 21.1], n)) < 0.015);
  const foot = timberGrain("foot", [0, 14, 16], [0, 0, 1]);
  assert.ok(
    Math.abs(foot - timberGrain("foot", [0.1, 14, 16], [0, 0, 1])) < 0.015,
  );
});
test("all timber faces and end grain stay finite with weathered roughness", () => {
  for (const [p, n] of [
    [
      [14, 14, 30],
      [0, -1, 0],
    ],
    [
      [14, 14, 48],
      [0, 0, 1],
    ],
    [
      [6, 14, 21],
      [0, -1, 0],
    ],
    [
      [-7, 14, 16],
      [-1, 0, 0],
    ],
  ]) {
    const paint = paintTimberPixel([80, 85, 89], p, n);
    assert.ok(paint.rgb.every((v) => Number.isFinite(v) && v > 4 && v < 255));
    assert.ok(paint.roughness >= 0.82 && paint.roughness <= 0.91);
  }
});
