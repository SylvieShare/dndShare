import test from "node:test";
import assert from "node:assert/strict";
import { cutStonePartAt, paintCutStone } from "./lost_cave_cut_stone.mjs";
import specs from "./lost_cave_recipes.mjs";
test("grid lining includes its native lower through-hole wall and upper bevel in each socket", () => {
  const s = {
    cutStone: {
      innerHalfMM: 13.5,
      lowerInnerHalfMM: 8.5,
      floorMM: 11.3209,
      topMM: 25.0756,
      bevelStartMM: 23.174,
      bevelTopHalfMM: 15.53,
      centresMM: [
        [0, 0],
        [0, 35],
      ],
    },
  };
  for (const y of [0, 35]) {
    assert.equal(cutStonePartAt([8.499, y, 5], [-1, 0, 0], s), "cut-stone");
    assert.equal(cutStonePartAt([13.5, y, 20], [-1, 0, 0], s), "cut-stone");
    assert.equal(
      cutStonePartAt([14.369, y, 24], [-0.689, 0, 0.725], s),
      "cut-stone",
    );
    assert.equal(cutStonePartAt([16.5, y, 24], [1, 0, 0], s), "rock");
  }
});
test("frame lining includes measured inward faces and floor while excluding outward cliff faces", () => {
  const s = specs["LC-060"];
  assert.equal(
    cutStonePartAt([2.0297, 13.4991, 18.5035], [0, -1, 0], s),
    "cut-stone",
  );
  assert.equal(
    cutStonePartAt([13.4998, 10.0863, 20.9457], [-1, 0, 0], s),
    "cut-stone",
  );
  assert.equal(
    cutStonePartAt([2.9218, 3.8516, 13.4742], [0, 0, 1], s),
    "cut-stone",
  );
  assert.equal(
    cutStonePartAt([16.0326, -17.5008, 22.6648], [0, -1, 0], s),
    "rock",
  );
  assert.equal(cutStonePartAt([0, 13.5, 20], [0, 1, 0], s), "rock");
  assert.equal(
    cutStonePartAt([2.0297, 13.4991, 24.9], [0.3, -0.707, 0.64], s),
    "cut-stone",
  );
  const clean = paintCutStone([0, 13.5, 20], [0, -1, 0], 255, s);
  const recess = paintCutStone([0, 13.5, 20], [0, -1, 0], 170, s);
  assert(clean.rgb.every((v, i) => v > recess.rgb[i]));
  assert.equal(clean.metallic, 0);
});
