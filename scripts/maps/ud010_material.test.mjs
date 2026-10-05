import { test } from "node:test";
import assert from "node:assert/strict";
import { doorPartAt, doorGrain, paintDoorPixel } from "./ud010_material.mjs";
import { bakedMaterialDetail } from "./material_detail.mjs";
import { srgbToLinear } from "./masonry_palette.mjs";
test("wood fills the curved top and both faces without colouring the stone arch", () => {
  for (const p of [
    [11.2, 0, 59],
    [11.2, 6, 59],
    [15.5, 0, 59],
    [11.2, 0, 28],
  ])
    assert.equal(doorPartAt(...p), "wood");
  for (const p of [
    [10.4, 0, 66],
    [10.4, 16, 40],
    [0, 0, 15],
    [13, 0, 14.5],
  ])
    assert.equal(doorPartAt(...p), "stone");
});

test("mixed old wood and stone keep continuous detail without triangular colour jumps", () => {
  const wood = [0.39, 0.22, 0.105].map(srgbToLinear),
    stone = [0.54, 0.51, 0.45].map(srgbToLinear);
  const srgb = (v) =>
    v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055;
  const details = [];
  for (const mix of [0, 0.25, 0.49, 0.51, 0.75, 1]) {
    const color = wood.map((v, i) =>
      Math.round(srgb((v * mix + stone[i] * (1 - mix)) * 0.85) * 255),
    );
    const detail = bakedMaterialDetail(color);
    details.push(detail);
    assert.ok(Math.abs(detail - 0.85) < 0.07);
  }
  assert.ok(Math.abs(details[2] - details[3]) < 0.06);
});
test("the straps, rivets and ring are iron on both sides", () => {
  for (const p of [
    [9.8, 0, 34],
    [16.6, 0, 34],
    [9.8, 10, 35],
    [16.6, 10, 35],
    [10.3, 12, 43],
    [16.1, 12, 43],
  ])
    assert.equal(doorPartAt(...p), "iron");
  assert.equal(doorPartAt(10.9, -5, 35), "iron");
  assert.equal(doorPartAt(15.7, -5, 21), "iron");
});
test("vertical grain stays continuous and hardware gets its own PBR response", () => {
  const grain = doorGrain(3, 40);
  assert.ok(Math.abs(grain - doorGrain(3, 40.1)) < 0.015);
  assert.ok(Math.abs(grain - doorGrain(3.3, 40)) > 0.01);
  const wood = paintDoorPixel([99, 56, 27], [11.2, 0, 59], [1, 0, 0]),
    iron = paintDoorPixel([99, 56, 27], [9.8, 0, 34], [1, 0, 0]);
  assert.equal(wood.metallic, 0);
  assert.equal(iron.metallic, 0.65);
  assert.ok(wood.roughness > iron.roughness);
  assert.ok(iron.rgb[0] <= iron.rgb[1] && iron.rgb[1] <= iron.rgb[2]);
  for (const color of [wood.rgb, iron.rgb])
    assert.ok(color.every((v) => Number.isFinite(v) && v > 4 && v < 255));
});
