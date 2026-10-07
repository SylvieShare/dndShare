import test from "node:test";
import assert from "node:assert/strict";
import { sewerMasonryPixel } from "./toxic_sewer_surface.mjs";
const spec = {
  stoneColor: [124, 137, 77],
  mortarColor: [58, 64, 39],
  floorHeightMM: 13.8,
};
test("sewer masonry has darker sculpt crevices and nonmetallic green stone", () => {
  const p = [5, 2, 18],
    n = [1, 0, 0];
  const raised = sewerMasonryPixel(p, n, 255, spec),
    seam = sewerMasonryPixel(p, n, 166, spec);
  assert.ok(seam.rgb.every((v, i) => v < raised.rgb[i]));
  assert.ok(raised.rgb[1] > raised.rgb[0] && raised.rgb[0] > raised.rgb[2]);
  assert.equal(raised.metallic, 0);
  assert.ok(raised.roughness > 0.8);
});
test("surface colour does not depend on sunlight direction or view", () => {
  assert.deepEqual(
    sewerMasonryPixel([5, 2, 20], [1, 0, 0], 220, spec).rgb,
    sewerMasonryPixel([5, 2, 20], [-1, 0, 0], 220, spec).rgb,
  );
  for (const p of [
    [-17, -17, 5],
    [0, 0, 14],
    [17, 17, 38],
  ]) {
    const value = sewerMasonryPixel(p, [0, 0, 1], 166, spec);
    assert.ok(value.rgb.every((v) => Number.isFinite(v) && v >= 12));
  }
});
