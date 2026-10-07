import test from "node:test";
import assert from "node:assert/strict";
import { caveTexturePlan } from "./cave_texture_plan.mjs";
test("existing cave textures keep their checked sizes while compact inserts use a smaller explicit plan", () => {
  assert.deepEqual(caveTexturePlan({}, "ktx-compact"), [1024, 1024, 512, 512]);
  assert.deepEqual(
    caveTexturePlan(
      { textureCandidates: { "ktx-compact": [512, 512, 256, 256] } },
      "ktx-compact",
    ),
    [512, 512, 256, 256],
  );
  for (const plan of [
    [512, 512],
    [512, 0, 256, 256],
    [512, 512, 256, 4096],
  ])
    assert.throws(() =>
      caveTexturePlan(
        { textureCandidates: { "ktx-compact": plan } },
        "ktx-compact",
      ),
    );
  assert.throws(() => caveTexturePlan({}, "other"));
});
