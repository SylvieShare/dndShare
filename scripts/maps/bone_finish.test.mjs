import test from "node:test";
import assert from "node:assert/strict";
import { finishBone } from "./bone_finish.mjs";
import { addedWallSurface } from "./wall_added_surface.mjs";
test("bone colour varies visibly across the pile but stays continuous at adjacent points", () => {
  const colours = [];
  for (let x = -12; x < 10; x += 3)
    for (let y = -12; y < 10; y += 3)
      colours.push(finishBone(1, [x, y, 24], 255).rgb);
  const warm = colours.map((c) => c[0] - c[2]);
  assert.ok(Math.max(...warm) - Math.min(...warm) > 20);
  const red = colours.map((c) => c[0]);
  assert.ok(Math.max(...red) - Math.min(...red) > 35);
  const a = finishBone(1, [2, 3, 24], 255).rgb,
    b = finishBone(1, [2.001, 3, 24], 255).rgb;
  assert.ok(a.every((v, i) => Math.abs(v - b[i]) <= 1));
  assert.ok(colours.every((c) => Math.min(...c) > 20 && c[0] > c[2]));
});
test("concavities are darker and rougher without changing material identity", () => {
  const clean = finishBone(1, [2, 3, 24], 255),
    dirty = finishBone(0.65, [2, 3, 24], 195);
  assert.ok(dirty.rgb.every((v, i) => v < clean.rgb[i]));
  assert.ok(dirty.roughness > clean.roughness);
  assert.equal(dirty.part, "bone");
  assert.equal(dirty.metallic, 0);
});
test("bone touching a wall uses distance to bare masonry instead of a plane cut", () => {
  const spec = {
    near: 9.8,
    far: 10,
    min: 9.8,
    zMin: 20,
    zMax: 20.2,
    step: 0.2,
    slabSize: 2,
    spanSize: 2,
    zSize: 2,
    distanceScale: 255,
  };
  const field = { spec, x: Buffer.alloc(8, 0), y: Buffer.alloc(8, 0) };
  assert.equal(addedWallSurface([10, 10, 20], field), false);
  field.x.fill(130);
  field.y.fill(130);
  assert.equal(addedWallSurface([10, 10, 20], field), true);
  assert.equal(addedWallSurface([15, 15, 20], field), false);
});
