import test from "node:test";
import assert from "node:assert/strict";
import specs from "./lost_cave_recipes.mjs";
import { paintCaveMine } from "./lost_cave_mine.mjs";

test("mine flame needs both its visible source contour and measured volume; neighbouring wood and stone never emit", () => {
  const s = specs["LC-079"],
    flame = () => ({ part: "flame" });
  const base = paintCaveMine(
      [-7.6755, -1.414, 41.1813],
      [1, 0, 0],
      40,
      s,
      undefined,
      flame,
    ),
    tip = paintCaveMine(
      [-12.2415, -0.0705, 46.9494],
      [0, 0, 1],
      40,
      s,
      undefined,
      flame,
    );
  assert.equal(base.part, "flame");
  assert.equal(base.metallic, 0);
  assert(base.emission[0] > 100);
  assert(base.rgb[1] > tip.rgb[1]);
  assert.equal(
    paintCaveMine([-12.2415, -0.0705, 46.9494], [0, 0, 1], 220, s).emission,
    undefined,
  );
  for (const p of [
    [-12.2255, 9.6846, 38.2882],
    [-11.1473, 12.2202, 21.6284],
    [-6.6886, -2.956, 40.2756],
    [-13.4482, 0.2971, 47.8726],
  ])
    assert.equal(
      paintCaveMine(p, [0, 0, 1], 220, s, undefined, flame).emission,
      undefined,
    );
  assert.equal(
    paintCaveMine(
      [-12.2415, -0.0705, 46.9494],
      [0, 0, 1],
      220,
      { ...s, torch: { ...s.torch, lit: false } },
      undefined,
      flame,
    ).emission,
    undefined,
  );
});
