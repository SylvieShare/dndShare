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

test("second jaw uses measured contours and keeps stone between teeth without a bare-ground fallback", () => {
  const spec = specs["LC-044"];
  for (const p of [
    [-4.6062, 3.4696, 15.7986],
    [7.752, -12.2574, 14.9494],
    [-10.7854, 11.8976, 14.8632],
  ])
    assert.equal(caveBonePartAt(p, spec), "bone");
  for (const p of [
    [10.5607, 13.5834, 14.5562],
    [5.505, 4.5963, 14.2054],
    [9.4372, 7.4044, 14.4965],
    [0, 0, 8],
  ])
    assert.equal(caveBonePartAt(p, spec), "rock");
});

test("padded bone contour colours bulging sides while excluding adjacent flat ground", () => {
  const spec = {
    floorHeightMM: 14.7,
    bones: {
      regionsOnly: true,
      minZ: 12.5,
      regionPaddingMM: 0.85,
      paddingNormalMaxZ: 0.8,
      directRegions: [
        [
          [0, 0],
          [2, 0],
          [2, 2],
          [0, 2],
        ],
      ],
    },
  };
  assert.equal(
    caveBonePartAt([2.5, 1, 14.6], spec, undefined, [1, 0, 0]),
    "bone",
  );
  assert.equal(
    caveBonePartAt([2.5, 1, 14.6], spec, undefined, [0, 0, 1]),
    "rock",
  );
  assert.equal(
    caveBonePartAt([2.5, 1, 15.2], spec, undefined, [0, 0, 1]),
    "bone",
  );
  assert.equal(
    caveBonePartAt([2.5, 1, 10], spec, undefined, [1, 0, 0]),
    "rock",
  );
});

test("cave bone padding protects unchanged stone and fades colour at dirty contacts", () => {
  const spec = {
    ...specs["LC-045"],
    bones: {
      regionsOnly: true,
      minZ: 12.5,
      regionPaddingMM: 0.7,
      paddingNormalMaxZ: 0.8,
      paddingMatchMM: 0.25,
      softPadding: true,
      directRegions: [
        [
          [0, 0],
          [2, 0],
          [2, 2],
          [0, 2],
        ],
      ],
    },
  };
  const p = [2.2, 1, 14.6],
    normal = [1, 0, 0];
  assert.equal(
    caveBonePartAt(p, spec, { distanceAt: () => 0.1 }, normal),
    "rock",
  );
  const dirty = paintCaveBones(p, normal, 240, spec, { distanceAt: () => 0.4 });
  const pale = paintCaveBones([1.9, 1, 14.6], normal, 240, spec, {
    distanceAt: () => 0.4,
  });
  assert.equal(dirty.part, "bone");
  assert(dirty.rgb[0] < pale.rgb[0]);
  assert(dirty.roughness >= pale.roughness);
});
