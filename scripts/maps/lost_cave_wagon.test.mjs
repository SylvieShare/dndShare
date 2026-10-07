import test from "node:test";
import assert from "node:assert/strict";
import specs from "./lost_cave_recipes.mjs";
import { wagonPartAt, paintWagon } from "./lost_cave_wagon.mjs";
test("measured wagon wheels, brake pipe and brass disk remain separate from rusty shell", () => {
  const s = specs["LC-027"];
  for (const p of [
    [-12.5718, 7.7775, 4.3285],
    [-12.1394, -5.7142, 4.9966],
  ])
    assert.equal(wagonPartAt(p, s), "wheel");
  for (const p of [
    [-10.0172, 17.1419, 34.0035],
    [-9.8679, 16.6998, 24.3433],
    [1.8162, 14.1578, 3.8968],
    [-10.0145, 17.136, 35.5292],
    [-4.0996, 12.2628, 4.7137],
    [3.5483, 14.4394, 1.3455],
  ])
    assert.equal(wagonPartAt(p, s), "hardware");
  assert.equal(wagonPartAt([8.2298, 17.0616, 31.5765], s), "brass");
  for (const p of [
    [0, 0, 18.7494],
    [14.496, -2.6493, 23.0353],
  ])
    assert.equal(wagonPartAt(p, s), "bucket");
  assert.ok(
    paintWagon([8.2298, 17.0616, 31.5765], [0, 1, 0], 240, s).metallic > 0.8,
  );
  assert.throws(() => paintWagon([0, 0, 18], [0, 0, 1], Buffer.alloc(8), s));
});
