import test from "node:test";
import assert from "node:assert/strict";
import { floorJointWeight, paintFloorJoint } from "./floor_seams.mjs";
test("only recessed masonry floor is darkened, not stone crests, wood or skulls", () => {
  const stone = [80, 89, 94],
    up = [0, 0, 1];
  assert.ok(floorJointWeight(stone, [0, 0, 13.3], up) > 0.9);
  assert.equal(floorJointWeight(stone, [0, 0, 14.3], up), 0);
  assert.equal(floorJointWeight(stone, [0, 0, 30], up), 0);
  assert.equal(floorJointWeight([105, 75, 45], [0, 0, 13.3], up), 0);
  assert.equal(floorJointWeight([185, 172, 138], [0, 0, 13.3], up), 0);
  assert.equal(floorJointWeight(stone, [17.2, 0, 13.3], up), 0);
  assert.equal(floorJointWeight(stone, [0, 0, 13.3], [0, 0, -1]), 0);
  assert.ok(
    paintFloorJoint(stone, [0, 0, 13.3], up).rgb.every(
      (v, i) => v < stone[i] && v > 4,
    ),
  );
});
