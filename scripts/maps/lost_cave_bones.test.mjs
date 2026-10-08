import test from "node:test";
import assert from "node:assert/strict";
import { caveBonePartAt, paintCaveBones } from "./lost_cave_bones.mjs";
import specs from "./lost_cave_recipes.mjs";

test("low bone cavities stay pale while unrelated changed ground and mounting stay stone", () => {
  const spec = specs["LC-043"];
  const reference = { distanceAt: () => 2 };
  assert.equal(
    caveBonePartAt([-3.1789, 1.128, 6.4944], spec, reference),
    "bone",
  );
  assert.equal(caveBonePartAt([-15, 12, 7], spec, reference), "rock");
  assert.equal(caveBonePartAt([0, 0, 2], spec, reference), "rock");
  // A bone intersecting the bare ground still retains its semantic material.
  assert.equal(
    caveBonePartAt([-3.1789, 1.128, 6.4944], spec, { distanceAt: () => 0 }),
    "bone",
  );
  for (const p of [
    [-1.8444, -14.6898, 7.8509],
    [1.9224, -12.8194, 7.8839],
    [5.2359, -10.6943, 7.8618],
    [8.5287, -2.9644, 7.9007],
    [11.9277, 0.4082, 7.8815],
  ])
    assert.equal(caveBonePartAt(p, spec, { distanceAt: () => 0 }), "bone");
  const bone = paintCaveBones(
    [-3.1789, 1.128, 6.4944],
    [0, 0, 1],
    240,
    spec,
    reference,
  );
  assert.equal(bone.metallic, 0);
  assert(bone.rgb[0] > bone.rgb[2]);
  assert(bone.roughness >= 0.8);
});
