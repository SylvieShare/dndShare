import test from "node:test";
import assert from "node:assert/strict";
import specs from "./ultimate-fountains.json" with { type: "json" };
import { fountainPartAt, makeFountainPainter } from "./fountain_material.mjs";
import { treasurePartAt } from "./treasure_material.mjs";
const reference = (p, d) => ({
  spec: { low: p, step: 1, size: [1, 1, 1], scale: 255 },
  data: Buffer.from([Math.round(d * 255)]),
});

test("empty fountain separates its chains, skull and low bone tip from masonry", () => {
  const spec = specs["UD-041"];
  assert.equal(fountainPartAt([6.2547, -12.3073, 27.9208], spec), "iron");
  assert.equal(fountainPartAt([1.1564, -12.3938, 18.1291], spec), "bone");
  assert.equal(fountainPartAt([-5.4204, -0.508, 14.3035], spec), "bone");
  assert.equal(fountainPartAt([12, 0, 32], spec), "stone");
});

test("outer crystal faces remain purple while the bowl and top wall joints remain stone", () => {
  const spec = specs["UD-042"],
    outer = [7.4249, -12.8064, 28.7731];
  assert.equal(fountainPartAt(outer, spec, reference(outer, 1)), "crystal");
  const cap = [-3.9668, 1.5656, 24.5356],
    wall = [11, 0, 38.18];
  assert.equal(fountainPartAt(cap, spec, reference(cap, 1)), "stone");
  assert.equal(fountainPartAt(wall, spec, reference(wall, 1)), "stone");
});

test("toxic fountain keeps carved spout stone and distinguishes skulls from liquid", () => {
  const spec = specs["UD-043"],
    spout = [11.054, 0.7194, 36.7611],
    flow = [8.7922, 1.2878, 27.4947];
  assert.equal(fountainPartAt(spout, spec, reference(spout, 1)), "stone");
  assert.equal(fountainPartAt(flow, spec, reference(flow, 1)), "toxic");
  assert.equal(
    fountainPartAt([4.7662, 10.8429, 28.3231], spec, reference(flow, 1)),
    "bone",
  );
  assert.equal(
    fountainPartAt([6.2227, -6.6706, 25.0394], spec, reference(flow, 1)),
    "bone",
  );
});

test("bone on basin rim stays ivory but coincident bare stone is not painted", () => {
  const spec = specs["UD-043"],
    p = [-0.6579, -6.4915, 26.6522];
  assert.equal(fountainPartAt(p, spec, reference(p, 1)), "bone");
  assert.equal(fountainPartAt(p, spec, reference(p, 0)), "stone");
});

test("low coin basins are metal without gilding surrounding pavers or the lower bowl", () => {
  const spec = specs["UD-044"],
    coin = [-12.7038, 7.2851, 13.888],
    silver = [-12.6478, -13.3091, 14.7587];
  assert.equal(treasurePartAt(coin, spec, reference(coin, 0)), "gold");
  assert.equal(treasurePartAt(silver, spec, reference(silver, 0)), "silver");
  for (const p of [
    [-15.9, 10.2, 14.2],
    [-3.3, 0, 18.5],
    [11.54, 0, 30],
  ])
    assert.equal(treasurePartAt(p, spec, reference(p, 0)), "stone");
});

test("gemstones and acid have nonmetallic PBR responses and finite colours", () => {
  const cases = [
    ["UD-042", [7.4249, -12.8064, 28.7731]],
    ["UD-043", [8.7922, 1.2878, 27.4947]],
    ["UD-044", [5.7622, 8.4288, 29.4694]],
  ];
  for (const [code, p] of cases) {
    const paint = makeFountainPainter(specs[code], reference(p, 1));
    const result = paint([120, 130, 100], p, [0, 0, 1], 220);
    assert.equal(result.metallic, 0);
    assert.ok(
      result.rgb.every((v) => Number.isFinite(v) && v >= 0 && v <= 255),
    );
    assert.ok(result.roughness > 0 && result.roughness <= 1);
  }
});
