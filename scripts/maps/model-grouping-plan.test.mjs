import { test } from "node:test";
import assert from "node:assert/strict";
import { groupingPlan, groupingFor } from "./model-grouping-plan.mjs";
const model = (name, code, extra = {}) => ({
  name,
  sourceName: name,
  code,
  width: 1,
  height: 1,
  tileType: "floor",
  wallMode: "none",
  wallMask: 0,
  ...extra,
});
test("ground shapes share a section while straight skins are variants", () => {
  const models = [
    model("Ground Straight 1", "MED-ground-straight"),
    model("Ground Straight 2", "MED-ground-straight"),
    model("Ground 1 Corner", "MED-ground-corner"),
    model("Ground 2 Corners", "MED-ground-corner"),
  ];
  const plan = groupingPlan(models);
  assert.ok(plan.every((entry) => entry.code === "MED-ground"));
  assert.equal(plan[0].variantCode, plan[1].variantCode);
  assert.notEqual(plan[2].variantCode, plan[3].variantCode);
  assert.notEqual(plan[0].variantCode, plan[2].variantCode);
});
test("bar heights and corners split; bath states stay in one variant family", () => {
  const bars = [
    "Bar Empty",
    "Bar Plates",
    "Tall Bar Empty",
    "Bar Angle Empty",
    "Tall Bar Angle Empty",
  ].map((name) => model(name, "MED-bar"));
  const plan = groupingPlan(bars);
  assert.ok(plan.every((entry) => entry.code === "MED-bar"));
  assert.equal(plan[0].variantCode, plan[1].variantCode);
  assert.equal(new Set(plan.map((entry) => entry.variantCode)).size, 4);
  const baths = [
    model("Bath Empty", "MED-bath"),
    model("Bath Water", "MED-bath"),
  ];
  assert.equal(
    groupingFor(baths[0], baths).variantCode,
    groupingFor(baths[1], baths).variantCode,
  );
});
test("reviewed classification is not overwritten and grid sizes are not variants", () => {
  const reviewed = model("Custom Ground", "MED-user-group", {
    variantCode: "MED-user-variants",
  });
  assert.deepEqual(groupingFor(reviewed, [reviewed]), {
    code: reviewed.code,
    variantCode: reviewed.variantCode,
  });
  const frames = [
    model("Level Grid 1X1", "UD-level-grid"),
    model("Level Grid 2X2", "UD-level-grid", { width: 2, height: 2 }),
  ];
  assert.notEqual(
    groupingFor(frames[0], frames).variantCode,
    groupingFor(frames[1], frames).variantCode,
  );
});

test("Medieval tall walls and corners share the wall section with distinct families", () => {
  for (const [name, code] of [
    ["Tall Angle", "MED-tall-angle"],
    ["Tall Angle Half Wall", "MED-tall-angle-half-wall"],
    ["Tall Wall 1", "MED-tall-wall"],
    ["Tall Window With Glass", "MED-tall-window"],
    ["Tall Door", "MED-tall-door"],
    ["Tall Skull Wall", "MED-tall-skull-wall"],
    ["Tall Pig Wall", "MED-tall-pig-wall"],
  ]) {
    const item = model(name, code);
    assert.deepEqual(groupingFor(item, [item]), {
      code: "MED-walls",
      variantCode: code,
    });
  }
  const ladder = model("Tall Ladder", "MED-tall-ladder");
  assert.equal(groupingFor(ladder, [ladder]).code, ladder.code);
});
