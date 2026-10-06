import test from "node:test";
import assert from "node:assert/strict";
import { torchPartAt, makeTorchPainter } from "./torch_material.mjs";
import { brazierPartAt } from "./brazier_material.mjs";
import { woodFloorPartAt } from "./wood_floor_material.mjs";

test("basic torch separates flame lobes from iron stakes and background bricks", () => {
  const spec = { variant: "basic", lit: true };
  assert.equal(torchPartAt([7.1759, -0.6961, 43.7213], spec), "flame");
  assert.equal(torchPartAt([4.7772, -0.604, 40.8025], spec), "iron");
  assert.equal(torchPartAt([6.2151, 3.2651, 41.3714], spec), "iron");
  assert.equal(torchPartAt([11.54, 4.2226, 24.3308], spec), "stone");
});

test("niche torch preserves the arch and gives its lower cup iron", () => {
  const spec = { variant: "niche", lit: true };
  assert.equal(torchPartAt([11.0434, -0.5654, 35.1997], spec), "flame");
  assert.equal(torchPartAt([11.378, -2.2371, 26.0853], spec), "iron");
  assert.equal(torchPartAt([11.4244, 5.1591, 22.6941], spec), "stone");
  assert.equal(torchPartAt([12.3404, -1.624, 22.4138], spec), "wood");
});

test("extinguished torch has separate dry ash and burnt timber inside its iron cup", () => {
  const spec = { variant: "niche", lit: false };
  assert.equal(torchPartAt([12.9169, 2.1003, 33.4434], spec), "charcoal");
  assert.equal(torchPartAt([12.2167, 1.7345, 31.4515], spec), "ash");
  assert.equal(torchPartAt([9.2647, -2.7248, 33.1715], spec), "iron");
});

test("flame roots remain yellower than tips and each material has a valid PBR response", () => {
  const paint = makeTorchPainter({ variant: "basic", lit: true });
  const root = paint([100, 100, 90], [7.75, 0, 41], [0, 0, 1]);
  const tip = paint([100, 100, 90], [7.75, 0, 46], [0, 0, 1]);
  assert.ok(root.rgb[1] > tip.rgb[1] + 60);
  assert.equal(root.metallic, 0);
  for (const p of [
    [9.75, 0, 32],
    [7.75, 3.5, 37],
    [12, 4, 25],
  ]) {
    const result = paint([100, 100, 90], p, [0, 0, 1]);
    assert.ok(
      result.rgb.every((v) => Number.isFinite(v) && v >= 0 && v <= 255),
    );
    assert.ok(result.roughness >= 0 && result.roughness <= 1);
    assert.ok(result.metallic >= 0 && result.metallic <= 1);
  }
});

test("brazier coal is nonmetallic geometry inside the cage, including the low metal ring", () => {
  assert.equal(brazierPartAt([-0.0012, -0.0094, 25.9949]), "charcoal");
  assert.equal(brazierPartAt([-0.8278, -11.9066, 15.2515]), "iron");
  assert.equal(brazierPartAt([4.3001, -10.328, 14.0985]), "stone");
});

test("wall timber ground uses the higher datum but leaves the formerly brown top bricks stone", () => {
  const spec = { wall: true, heightOffset: 6.75 };
  assert.equal(woodFloorPartAt([-14.2078, 12.702, 17.4659], spec), "iron");
  assert.equal(woodFloorPartAt([1.2872, 0.6779, 16.1067], spec), "wood");
  assert.equal(woodFloorPartAt([13.8174, 0.6335, 38.1802], spec), "stone");
});
