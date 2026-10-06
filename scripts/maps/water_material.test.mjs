import test from "node:test";
import assert from "node:assert/strict";
import specs from "./ultimate-water.json" with { type: "json" };
import { waterPartAt, makeWaterPainter } from "./water_material.mjs";
test("thin water surface is blue above its actual height, with a neutral insertion base", () => {
  const spec = specs["UD-074"],
    paint = makeWaterPainter(spec);
  assert.equal(waterPartAt([0, 0, 9], spec), "water");
  assert.equal(waterPartAt([0, 0, 4], spec), "stone");
  const water = paint([137, 130, 115], [0, 0, 9], [0, 0, 1], 255);
  assert.ok(water.rgb[2] > water.rgb[1] && water.rgb[1] > water.rgb[0]);
  assert.ok(water.roughness < 0.3);
  assert.equal(water.metallic, 0);
});
test("raised ripples surrounding all three rocks stay water", () => {
  const spec = specs["UD-075"];
  for (const p of [
    [12.7192, 15.2818, 9.1601],
    [-13.541, 13.9481, 9.2213],
    [-12.9256, -15.4923, 9.2932],
  ])
    assert.equal(waterPartAt(p, spec), "water");
  for (const p of [
    [-1.9496, 8.1973, 12.4056],
    [-9.8482, -9.4455, 11.978],
    [8.3083, -6.6766, 12.3242],
  ])
    assert.equal(waterPartAt(p, spec), "stone");
});
test("low bone shaft stays ivory and water around skull silhouettes stays blue", () => {
  const spec = specs["UD-076"];
  for (const p of [
    [-11.2811, -3.3855, 8.1728],
    [-7.3843, -6.1545, 8.2575],
    [-2.8722, -4.6172, 8.705],
    [-0.7187, 9.837, 11.2403],
    [9.6386, -9.0334, 12.003],
  ])
    assert.equal(waterPartAt(p, spec), "bone");
  for (const p of [
    [0, 13.5, 8.5],
    [13, -9, 8.5],
    [0, 0, 9],
  ])
    assert.equal(waterPartAt(p, spec), "water");
});
test("well water stays inside the measured disk, preserving the rim and outer cobbles", () => {
  const spec = specs["UD-077"];
  assert.equal(waterPartAt([8.6152, -0.0114, 20.7548], spec), "water");
  assert.equal(waterPartAt([9.6407, -0.0115, 20.8161], spec), "water");
  assert.equal(waterPartAt([-1.5374, 6.4474, 21.7187], spec), "water");
  assert.equal(waterPartAt([9.9483, -1.0461, 25.3025], spec), "stone");
  assert.equal(waterPartAt([-14.1512, 13.7436, 14.2344], spec), "stone");
});
