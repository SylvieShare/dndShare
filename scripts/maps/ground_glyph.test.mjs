import test from "node:test";
import assert from "node:assert/strict";
import { groundGlyphAt, makeGroundGlyphPainter } from "./ground_glyph.mjs";
const slab = {
  min: -17.5,
  step: 35,
  size: 2,
  heights: [14.875, 14.875, 14.875, 14.875],
};
test("pigment follows the deep carving, excluding raised islands and the outer slab", () => {
  const spec = { pigment: [0.6, 0.24, 0.205] };
  assert.ok(groundGlyphAt([0, 0, 13.5], [0, 0, 1], slab, spec));
  assert.equal(groundGlyphAt([0, 0, 14.7], [0, 0, 1], slab, spec), false);
  assert.equal(groundGlyphAt([16, 0, 13.5], [0, 0, 1], slab, spec), false);
  assert.equal(groundGlyphAt([0, 0, 13.5], [1, 0, 0], slab, spec), false);
});
test("fire follows its actual left-pointing orientation without changing stone or metal response", () => {
  const spec = {
    pigment: [0.82, 0.64, 0.24],
    gradient: { axis: 0, from: 11, to: -13, color: [0.7, 0.31, 0.14] },
  };
  const paint = makeGroundGlyphPainter(slab, spec);
  const base = paint([140, 135, 120], [10, 0, 13.5], [0, 0, 1]);
  const tip = paint([140, 135, 120], [-12, 0, 13.5], [0, 0, 1]);
  assert.ok(base.rgb[1] > tip.rgb[1] + 40);
  assert.equal(base.part, "glyph");
  assert.equal(base.metallic, 0);
  assert.equal(paint([140, 135, 120], [0, 0, 14.8], [0, 0, 1]).part, "floor");
});
