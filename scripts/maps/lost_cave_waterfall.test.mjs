import test from "node:test";
import assert from "node:assert/strict";
import specs from "./lost_cave_recipes.mjs";
import { waterfallPartAt, paintWaterfall } from "./lost_cave_waterfall.mjs";

test("waterfall masks require source visibility and measured volumes", () => {
  const s = structuredClone(specs["LC-090"]);
  s.waterfall.volumes = {
    water: [{ min: [-6, -10, 17], max: [1, 10, 64] }],
  };
  const water = () => ({ part: "water" });
  assert.equal(waterfallPartAt([-3, 4, 38], s, water), "water");
  assert.equal(waterfallPartAt([-14, 4, 38], s, water), "rock");
  assert.equal(
    waterfallPartAt([-3, 4, 38], s, () => undefined),
    "rock",
  );
  assert.throws(() => waterfallPartAt([-3, 4, 38], s), /source masks/);
  assert.equal(
    waterfallPartAt([-3, 4, 38], s, () => ({
      part: "water",
      volumes: [{ min: [-6, -10, 40], max: [1, 10, 64] }],
    })),
    "rock",
    "a measured part volume excludes the neighbouring surface",
  );
});

test("flow is wet nonmetal and foam stays lighter without emitting light", () => {
  const s = specs["LC-090"];
  const values = {};
  for (const part of ["water", "foam", "pool", "boulder", "rock"])
    values[part] = paintWaterfall([0, 1, 17], [0, 0, 1], 240, s, () => ({
      part,
    }));
  assert(values.water.rgb[1] > values.water.rgb[0] * 2);
  assert(values.foam.rgb[0] > values.water.rgb[0] + 60);
  assert(values.water.roughness < 0.25);
  assert(values.foam.roughness > values.water.roughness);
  assert(values.boulder.roughness > 0.8);
  for (const value of Object.values(values)) {
    assert.equal(value.metallic, 0);
    assert.equal(value.emission, undefined);
    assert.equal(value.normalNeutral, undefined, "source flow relief retained");
  }
});
