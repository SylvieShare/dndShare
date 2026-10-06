import test from "node:test";
import assert from "node:assert/strict";
import specs from "./ultimate-arches.json" with { type: "json" };
import { architecturalBonePartAt } from "./architectural_bones.mjs";
test("arch skulls on both sides and low femurs receive bone material", () => {
  const spec = specs["UD-078"];
  for (const p of [
    [-14.4368, -6.0525, 40.4307],
    [12.6318, -6.9141, 38.0331],
    [5.7207, 20.0908, 40.9382],
    [12.4743, 5.1382, 17.716],
    [-7.3674, 16.1448, 15.8045],
    [-13.8512, 17.3109, 15.3509],
    [11.862, 9.0469, 14.855],
  ])
    assert.equal(architecturalBonePartAt(p, spec), "bone");
});
test("measured stone platforms and overhanging arch remain masonry", () => {
  const spec = specs["UD-078"];
  for (const p of [
    [-14.7837, -7.0797, 37.326],
    [12.2872, -7.6715, 34.5849],
    [6.708, 19.3501, 37.6466],
    [0, 0, 60],
    [0, -25, 90],
    [0, 0, 13],
  ])
    assert.equal(architecturalBonePartAt(p, spec), "stone");
});
test("broken arch has one rear skull and no ivory rubble or broken post caps", () => {
  const spec = specs["UD-079"];
  assert.equal(
    architecturalBonePartAt([5.3493, 11.5484, 41.2259], spec),
    "bone",
  );
  assert.equal(
    architecturalBonePartAt([5.9168, 10.7398, 37.2461], spec),
    "stone",
  );
  assert.equal(
    architecturalBonePartAt([2.5347, 9.9362, 41.3393], spec),
    "stone",
  );
  assert.equal(
    architecturalBonePartAt([5.7997, 10.9066, 37.9087], spec),
    "stone",
  );
  for (const p of [
    [-13, 0, 36],
    [13, 0, 35],
    [-11, 5, 16],
    [11, 5, 16],
    [0, 0, 70],
  ])
    assert.equal(architecturalBonePartAt(p, spec), "stone");
});
