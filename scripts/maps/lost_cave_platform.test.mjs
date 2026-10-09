import test from "node:test";
import assert from "node:assert/strict";
import { platformPartAt, paintCavePlatform } from "./lost_cave_platform.mjs";
import specs from "./lost_cave_recipes.mjs";
const s = specs["LC-069"];
test("LC-069 separates its measured upward cut from strata and the surrounding floor", () => {
  assert.equal(
    platformPartAt([-6.1274, 2.5429, 26.428], [0, 0, 1], s),
    "platform-top",
  );
  assert.equal(
    platformPartAt([6.9311, -11.8045, 24.1507], [0, -1, 0.2], s),
    "platform-side",
  );
  assert.equal(
    platformPartAt([11.1671, -8.6085, 26.3024], [0.65, -0.35, 0.6694], s),
    "platform-top",
  );
  assert.equal(
    platformPartAt([15.0893, -10.2409, 14.6474], [0, 0, 1], s),
    "rock",
  );
  const top = paintCavePlatform([0, 0, 26.5], [0, 0, 1], 245, s);
  const side = paintCavePlatform([6, -11, 24], [0, -1, 0.2], 200, s);
  assert.equal(top.metallic, 0);
  assert.equal(side.metallic, 0);
  assert(top.roughness > side.roughness);
  assert(top.rgb[0] > top.rgb[2]);
});
test("stone top colour stays continuous across the former normal classification threshold", () => {
  const p = [9, -8, 26.2];
  const a = paintCavePlatform(p, [0.8, 0, 0.599], 230, s);
  const b = paintCavePlatform(p, [0.8, 0, 0.601], 230, s);
  assert(Math.max(...a.rgb.map((v, i) => Math.abs(v - b.rgb[i]))) <= 1);
  assert(Math.abs(a.roughness - b.roughness) < 0.001);
});
test("LC-070 uses its own upper cut and preserves the taller fractured side", () => {
  const s = specs["LC-070"];
  assert.equal(
    platformPartAt([5.4867, 6.9016, 41.2627], [0, 0, 1], s),
    "platform-top",
  );
  assert.equal(
    platformPartAt([13.9503, -5.9139, 21.2244], [0.918, -0.388, -0.08], s),
    "platform-side",
  );
  assert.equal(platformPartAt([0, 0, 26.5], [0, 0, 1], s), "platform-side");
});
test("LC-071 limits the low platform without colouring its taller cliff", () => {
  const s = specs["LC-071"];
  assert.equal(
    platformPartAt([4.0308, 2.3762, 25.9604], [0, 0, 1], s),
    "platform-top",
  );
  assert.equal(
    platformPartAt([11.6632, -2.8875, 20.7543], [0.99, -0.1, 0], s),
    "platform-side",
  );
  assert.equal(
    platformPartAt([0.5784, 3.1164, 36.2164], [0.75, -0.66, 0], s),
    "rock",
  );
});
test("LC-072 distinguishes the small ledge from a nearby vertical side", () => {
  const s = specs["LC-072"];
  assert.equal(
    platformPartAt([-3.1941, -3.0918, 24.347], [0, 0, 1], s),
    "platform-top",
  );
  assert.equal(
    platformPartAt([8.0984, 3.866, 21.129], [0, 0, 1], s),
    "platform-top",
  );
  assert.equal(
    platformPartAt([8.0984, 3.866, 21.129], [1, 0, 0], s),
    "platform-side",
  );
  assert.equal(
    platformPartAt([2.1545, 7.559, 31.363], [0.91, -0.32, 0.25], s),
    "rock",
  );
});
