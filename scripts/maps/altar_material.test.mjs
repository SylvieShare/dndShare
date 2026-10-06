import test from "node:test";
import assert from "node:assert/strict";
import specs from "./ultimate-altars.json" with { type: "json" };
import { altarPartAt } from "./altar_material.mjs";
const spec = specs["UD-080"];
const bare = {
  spec: { low: [-50, -50, 0], step: 50, size: [3, 3, 2], scale: 255 },
  data: new Uint8Array(18),
};
test("sheet folds touching the bare plate stay cloth without colouring the exposed stone", () => {
  assert.equal(altarPartAt([-1.4348, -2.0846, 37.5991], spec, bare), "cloth");
  assert.equal(altarPartAt([12, 0, 37.3], spec, bare), "stone");
  assert.equal(altarPartAt([0, 34, 38], spec, bare), "stone");
});
test("altar skull row remains ivory while the side ledge and column foot stay stone", () => {
  assert.equal(altarPartAt([-10.0174, 7.6834, 18.1085], spec, bare), "bone");
  assert.equal(altarPartAt([-8.7561, 1.6256, 17.7023], spec, bare), "bone");
  assert.equal(altarPartAt([-15.4841, -14.1395, 14.735], spec, bare), "stone");
  assert.equal(altarPartAt([-13, 0, 16.5], spec, bare), "stone");
  assert.equal(altarPartAt([-12.0633, -23.439, 16.9241], spec, bare), "stone");
});
test("raised crosses and scrollwork are gold, with neighbouring panel faces stone", () => {
  assert.equal(altarPartAt([1.1811, -20.276, 19.2787], spec, bare), "gold");
  assert.equal(altarPartAt([10.0486, 14.0714, 20.3914], spec, bare), "gold");
  assert.equal(altarPartAt([5.1945, -19.3772, 18.1419], spec, bare), "stone");
});
