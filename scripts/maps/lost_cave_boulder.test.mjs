import test from "node:test";
import assert from "node:assert/strict";
import { paintBoulder } from "./lost_cave_boulder.mjs";
import specs from "./lost_cave_recipes.mjs";
test("wagon rubble is green-grey nonmetallic mineral with darker crevices", () => {
  const s = specs["LC-030"],
    p = [-0.3714, 2.3544, 62.8252],
    n = [0, 0, 1];
  const clean = paintBoulder(p, n, 255, s),
    dirty = paintBoulder(p, n, 166, s);
  assert.equal(clean.part, "boulder");
  assert.equal(clean.metallic, 0);
  assert.ok(clean.rgb[1] > clean.rgb[0] && clean.rgb[1] > clean.rgb[2]);
  assert.ok(clean.rgb.every((v, i) => v > dirty.rgb[i]));
  assert.ok(clean.roughness >= 0.85 && clean.roughness <= 0.95);
  assert.throws(() => paintBoulder(p, n, Buffer.alloc(4), s), /numeric AO/);
});
