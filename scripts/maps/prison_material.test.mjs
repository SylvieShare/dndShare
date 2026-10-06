import test from "node:test";
import assert from "node:assert/strict";
import specs from "./ultimate-prison.json" with { type: "json" };
import { prisonPartAt, makePrisonPainter } from "./prison_material.mjs";
test("door grille and low crossbar stay iron, while cobbles remain stone", () => {
  assert.equal(
    prisonPartAt([12.7321, -0.9533, 33.6154], specs["UD-054"]),
    "iron",
  );
  assert.equal(
    prisonPartAt([13.2331, -14.2717, 15.6226], specs["UD-054"]),
    "iron",
  );
  assert.equal(
    prisonPartAt([8.1288, 3.5959, 13.828], specs["UD-054"]),
    "stone",
  );
});
test("duplicated angle name preserves the second grille and earth floor", () => {
  const angle = specs["UD-055-angle"];
  assert.equal(angle.sourceCode, "UD-055");
  assert.equal(prisonPartAt([0, 14.4, 16], angle), "iron");
  assert.equal(prisonPartAt([0, 0, 14], angle), "soil");
  assert.equal(prisonPartAt([0, 0, 6], specs["UD-057"]), "soil");
});
test("corner post and ring centres stay stone or soil rather than becoming metal", () => {
  const spec = specs["UD-058"];
  assert.equal(prisonPartAt([12.8092, -12.5348, 35.1202], spec), "stone");
  assert.equal(prisonPartAt([10.4992, -16.4038, 31.5801], spec), "stone");
  assert.equal(prisonPartAt([14.5, 11.3, 13.28], spec), "soil");
  assert.equal(prisonPartAt([16.2, 11.3, 14.7], spec), "iron");
  assert.equal(prisonPartAt([15.0822, 1.5049, 15.2593], spec), "iron");
});
test("soil is matte and nonmetallic, with finite pigment on each reviewed material", () => {
  const paint = makePrisonPainter(specs["UD-058"]);
  for (const p of [
    [0, 0, 13],
    [12.8092, -12.5348, 35.1202],
    [16.2, 11.3, 14.7],
  ]) {
    const result = paint([120, 130, 100], p, [0, 0, 1]);
    assert.ok(
      result.rgb.every((v) => Number.isFinite(v) && v >= 0 && v <= 255),
    );
    if (result.part === "soil") {
      assert.equal(result.metallic, 0);
      assert.ok(result.roughness > 0.9);
    }
  }
});
