import test from "node:test";
import assert from "node:assert/strict";
import specs from "./lost_cave_recipes.mjs";
import { caveRockPixel } from "./lost_cave_surface.mjs";
test("natural fractures stay darker than exposed rock without black albedo or metal", () => {
  const s = specs["LC-001"];
  for (const p of [
    [0, 0, 15],
    [-10, 8, 26],
    [15, -13, 38],
  ]) {
    const exposed = caveRockPixel(p, [0, 0, 1], 255, s),
      crevice = caveRockPixel(p, [0, 0, 1], 166, s);
    assert.ok(
      crevice.rgb.reduce((a, b) => a + b, 0) <
        exposed.rgb.reduce((a, b) => a + b, 0),
    );
    assert.ok(crevice.rgb.every((v) => Number.isFinite(v) && v > 4));
    assert.equal(exposed.metallic, 0);
    assert.ok(exposed.roughness > 0.8);
  }
});
