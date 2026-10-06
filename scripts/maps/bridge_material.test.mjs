import test from "node:test";
import assert from "node:assert/strict";
import {
  bridgeBoneAt,
  brokenBridgeBoneAt,
  bridgeIronAt,
  makeBridgePainter,
} from "./bridge_material.mjs";
test("bridge bones do not colour ordinary deck slabs or unrelated parapet", () => {
  assert.equal(bridgeBoneAt([0, 0, 25.15]), false);
  assert.equal(bridgeBoneAt([-30, 15, 30.1]), false);
  assert.equal(bridgeBoneAt([-1, 15, 32]), false);
  assert.equal(bridgeIronAt([-1, 15, 32]), true);
  assert.equal(bridgeIronAt([-10.77, -10.49, 33.83]), true);
  assert.equal(bridgeIronAt([14.3, 11.05, 30.1]), true);
  assert.equal(bridgeBoneAt([-11.08, 10.75, 27.92]), true);
  assert.equal(bridgeBoneAt([-11, 14, 30.1]), false);
  assert.equal(bridgeBoneAt([15.1, -10.6, 29]), true);
});
test("broken bridge femurs exclude the adjacent and underlying stone", () => {
  assert.equal(brokenBridgeBoneAt([-8, -12.75, 25.65]), true);
  assert.equal(brokenBridgeBoneAt([-8, -12.75, 25.1]), false);
  assert.equal(brokenBridgeBoneAt([0, 0, 25.1]), false);
  assert.equal(brokenBridgeBoneAt([-10.4, -18.6, 24]), true);
  assert.equal(brokenBridgeBoneAt([-6, -18, 20.72]), false);
});
test("bones retain organic roughness and stone remains nonmetallic", () => {
  const paint = makeBridgePainter("UD-020");
  const bone = paint([137, 130, 115], [-10.4, -18.6, 24], [0, 0, 1], 230);
  const stone = paint([137, 130, 115], [0, 0, 25.1], [0, 0, 1], 230);
  assert.equal(bone.part, "bone");
  assert.equal(stone.part, "stone");
  assert.ok(bone.rgb[0] > stone.rgb[0]);
  assert.equal(bone.metallic, 0);
});
