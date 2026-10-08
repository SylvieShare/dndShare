import test from "node:test";
import assert from "node:assert/strict";
import { projectedBoneAt } from "./lost_cave_bone_view.mjs";

test("projected bone mask colours the visible sculpt while excluding a wall behind it", () => {
  const spec = {
    centre: [0, 0, 0],
    right: [1, 0, 0],
    up: [0, 1, 0],
    outward: [0, 0, 1],
    scaleMM: 4,
    size: 4,
  };
  const data = Buffer.alloc(4 * 4 * 4);
  for (let i = 0; i < 16; i++) data.writeFloatLE(NaN, i * 4);
  data.writeFloatLE(2, (1 * 4 + 1) * 4);
  const view = { spec, data },
    mask = [
      [
        [1, 1],
        [2, 1],
        [2, 2],
        [1, 2],
      ],
    ];
  assert(projectedBoneAt([-0.5, 0.5, 2.02], view, mask, 0.1));
  assert(!projectedBoneAt([-0.5, 0.5, 0], view, mask, 0.1));
  assert(!projectedBoneAt([1, 0.5, 2], view, mask, 0.1));
  assert(!projectedBoneAt([-0.5, -0.5, 2], view, mask, 0.1));
});
