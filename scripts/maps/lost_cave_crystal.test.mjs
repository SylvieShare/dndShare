import test from "node:test";
import assert from "node:assert/strict";
import { paintCrystal } from "./lost_cave_crystal.mjs";
test("blue crystals vary in colour while retaining nonmetallic polish and darker recesses", () => {
  const spec = { crystal: { tint: [0.14, 0.22, 0.63] } };
  const clean = paintCrystal([2, 4, 12], [0, 0, 1], 255, spec);
  const recess = paintCrystal([2, 4, 12], [0, 0, 1], 166, spec);
  assert.equal(clean.metallic, 0);
  assert.ok(clean.rgb[2] > clean.rgb[1] * 2);
  assert.ok(recess.rgb.every((v, i) => v < clean.rgb[i]));
  assert.ok(clean.roughness > 0.25 && clean.roughness < 0.5);
  assert.throws(() =>
    paintCrystal([2, 4, 12], [0, 0, 1], Buffer.alloc(8), spec),
  );
});
