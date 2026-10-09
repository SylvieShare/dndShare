import test from "node:test";
import assert from "node:assert/strict";
import specs from "./lost_cave_recipes.mjs";
import { paintCaveMine } from "./lost_cave_mine.mjs";
import { finishMineCup } from "./lost_cave_torch.mjs";

test("extinguished cup soot coats its measured inward faces while its rim and outer shell remain metallic", () => {
  const s = specs["LC-080"],
    iron = {
      part: "iron",
      rgb: [100, 100, 100],
      roughness: 0.55,
      metallic: 0.72,
    };
  for (const [p, n] of [
    [
      [-10.5774, 1.9059, 38.9571],
      [0.5015, -0.7444, 0.4409],
    ],
    [
      [-9.6704, 2.5138, 39.8316],
      [0.112, -0.9856, 0.1263],
    ],
    [
      [-10.2256, 1.2689, 38.1314],
      [0.3438, -0.5132, 0.7864],
    ],
  ]) {
    const v = finishMineCup(iron, p, n, s);
    assert.equal(v.part, "soot");
    assert(v.metallic < 0.2);
    assert(v.roughness > 0.9);
    assert.equal(v.emission, undefined);
  }
  for (const [p, n] of [
    [
      [-7.6251, -1.4867, 37.9095],
      [0.8131, -0.559, -0.1621],
    ],
    [
      [-9.8281, -3.3698, 41.2499],
      [0.1743, 0.068, 0.9823],
    ],
  ])
    assert.equal(finishMineCup(iron, p, n, s), iron);
});

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
