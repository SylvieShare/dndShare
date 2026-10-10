import test from "node:test";
import assert from "node:assert/strict";
import { caveTexturePlan, caveTextureSize } from "./cave_texture_plan.mjs";
test("small iron boundaries keep source ORM resolution independently of compressed normals", () => {
  const spec = {
      renderBakeSize: 2048,
      lodBakeSize: 1024,
      ormTextureSizes: [2048, 1024],
    },
    plan = [2048, 768, 1024, 384];
  assert.equal(
    caveTextureSize(spec, plan, "render", "MetallicRoughness"),
    2048,
  );
  assert.equal(caveTextureSize(spec, plan, "lod", "MetallicRoughness"), 1024);
  assert.equal(caveTextureSize(spec, plan, "render", "Normal"), 768);
  assert.equal(caveTextureSize(spec, plan, "lod", "Normal"), 384);
  assert.equal(caveTextureSize({}, plan, "render", "MetallicRoughness"), 768);
  for (const values of [[2048], [2048, 2048], [0, 1024], [2048, 1024.5]])
    assert.throws(() =>
      caveTextureSize(
        { ...spec, ormTextureSizes: values },
        plan,
        "lod",
        "MetallicRoughness",
      ),
    );
});
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
