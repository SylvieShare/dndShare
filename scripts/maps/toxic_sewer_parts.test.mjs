import test from "node:test";
import assert from "node:assert/strict";
import {
  inSewerRegion,
  sewerPartAt,
  finishSewerPart,
} from "./toxic_sewer_parts.mjs";
test("angled window mask follows the hatch plane and excludes its raised metal frame", () => {
  const q = Math.SQRT1_2;
  const region = {
    ellipsoid: {
      centre: [0, 0, 20],
      radius: [5, 0.8, 5],
      basis: [
        [q, -q, 0],
        [q, q, 0],
        [0, 0, 1],
      ],
    },
  };
  assert.equal(inSewerRegion([2, -2, 20], region), true);
  assert.equal(inSewerRegion([1, 1, 20], region), false);
  assert.equal(inSewerRegion([0, 0, 26], region), false);
});
test("pipe volumes exclude adjacent masonry, include both surfaces and respect ends", () => {
  const r = {
    part: "copper",
    path: [
      [0, 0, 14],
      [0, 0, 35],
    ],
    radius: 2,
    min: [-3, -3, 14],
    max: [3, 3, 35],
  };
  assert.ok(inSewerRegion([1.9, 0, 20], r));
  assert.ok(inSewerRegion([-1.9, 0, 20], r));
  assert.equal(inSewerRegion([2.1, 0, 20], r), false);
  assert.equal(inSewerRegion([0, 0, 36], r), false);
  assert.equal(
    sewerPartAt(
      [10, 10, 20],
      { regions: [{ ...r, added: false }] },
      null,
      [10, 10],
    ).part,
    "copper",
  );
});
test("added pipe paint excludes the measured bare wall and respects source translation", () => {
  const reference = {
    floor: {
      low: [-10, -10],
      step: 20,
      size: [2, 2],
      values: [14, 14, 14, 14],
    },
    wall: { low: [-10, 14], step: 20, size: [2, 2], values: [11, 11, 11, 11] },
  };
  const spec = {
    regions: [
      { part: "copper", added: true, min: [-10, 5, 14], max: [10, 15, 35] },
    ],
  };
  assert.equal(sewerPartAt([0, 11, 20], spec, reference).part, "stone");
  assert.equal(sewerPartAt([0, 8.5, 20], spec, reference).part, "copper");
  assert.equal(sewerPartAt([2, 14, 20], spec, reference, [2, 3]).part, "stone");
  assert.throws(() => sewerPartAt([0, 8.5, 20], spec), /Measured bare/);
});
test("specific hardware overrides timber and liquid never gets metallic stone channels", () => {
  const spec = {
    regions: [
      { part: "iron", min: [-1, -1, 18], max: [1, 1, 20] },
      { part: "wood", min: [-5, -5, 14], max: [5, 5, 25] },
    ],
  };
  assert.equal(sewerPartAt([0, 0, 19], spec).part, "iron");
  assert.equal(sewerPartAt([4, 0, 19], spec).part, "wood");
  assert.equal(sewerPartAt([6, 0, 19], spec).part, "stone");
  const water = finishSewerPart({ part: "toxic" }, [0, 0, 14], [0, 0, 1], 230);
  assert.equal(water.metallic, 0);
  assert.ok(water.roughness < 0.35);
  const iron = finishSewerPart({ part: "iron" }, [0, 0, 19], [1, 0, 0], 230);
  assert.ok(iron.metallic > 0.5);
});
test("damaged floor mask follows the measured height deficit and keeps intact cobbles", () => {
  const reference = {
    floor: { low: [-1, -1], step: 1, size: [3, 3], values: Array(9).fill(14) },
  };
  const spec = { regions: [{ part: "rubble", eroded: 0.2 }] };
  assert.equal(sewerPartAt([0, 0, 13.5], spec, reference).part, "rubble");
  assert.equal(sewerPartAt([0, 0, 13.9], spec, reference).part, "stone");
  assert.equal(sewerPartAt([2, 0, 13], spec, reference).part, "stone");
  assert.equal(
    sewerPartAt([5, 6, 13.5], spec, reference, [5, 6]).part,
    "rubble",
  );
});
test("exposed column top follows source height while leaving lower brick sides intact", () => {
  const reference = {
    floor: { low: [0, 0], step: 1, size: [2, 2], values: [40, 55, 42, 57] },
  };
  const spec = {
    regions: [{ part: "rubble", topSurfaceMM: 0.7, min: [0, 0, 34] }],
  };
  assert.equal(sewerPartAt([0, 0, 39.5], spec, reference).part, "rubble");
  assert.equal(sewerPartAt([1, 0, 54.6], spec, reference).part, "rubble");
  assert.equal(sewerPartAt([1, 0, 40], spec, reference).part, "stone");
  assert.equal(sewerPartAt([2, 0, 60], spec, reference).part, "stone");
  assert.equal(
    sewerPartAt([3, 4, 39.5], spec, reference, [3, 4]).part,
    "rubble",
  );
});
test("flesh gradient reaches each measured tip without changing its roughness or metal", () => {
  const region = {
    part: "tentacle",
    roughness: 0.62,
    colorGradient: {
      startMM: 20,
      endMM: 40,
      from: [120, 130, 80],
      to: [200, 110, 170],
    },
  };
  const base = finishSewerPart(region, [0, 0, 20], [0, 0, 1], 240);
  const tip = finishSewerPart(region, [0, 0, 40], [0, 0, 1], 240);
  assert.ok(base.rgb[1] > base.rgb[2]);
  assert.ok(tip.rgb[2] > tip.rgb[1]);
  assert.equal(tip.roughness, base.roughness);
  assert.equal(tip.metallic, 0);
});
