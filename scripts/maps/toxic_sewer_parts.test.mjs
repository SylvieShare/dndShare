import test from "node:test";
import assert from "node:assert/strict";
import {
  inSewerRegion,
  sewerPartAt,
  finishSewerPart,
} from "./toxic_sewer_parts.mjs";
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
