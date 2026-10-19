import { test } from "node:test";
import assert from "node:assert/strict";
import { catalogueCategory, cataloguePlan } from "./model-catalogue-plan.mjs";
test("water and railway classification preserves structural wall geometry", () => {
  const model = {
    collection: "lost-cave",
    sourceName: "Railway Angle",
    tileType: "wall-angle",
  };
  assert.equal(catalogueCategory(model), "railway");
  assert.equal(model.tileType, "wall-angle");
  assert.equal(
    catalogueCategory({ ...model, sourceName: "Water Angle" }),
    "water",
  );
  assert.equal(
    catalogueCategory({ ...model, sourceName: "Wall Angle" }),
    "wall",
  );
  assert.equal(
    catalogueCategory({
      ...model,
      sourceName: "Water Wooden Bridge",
      tileType: "bridge",
    }),
    "bridge",
  );
});
test("free and furnished variants retain one bilingual section", () => {
  const base = {
    definitionId: "MT1-001",
    collection: "medieval-town-vol1",
    code: "MED-bar",
    name: "Bar Empty",
    sourceName: "Bar Empty",
    tileType: "floor",
    hasDecor: false,
  };
  const plan = cataloguePlan([
    base,
    { ...base, definitionId: "MT1-002", name: "Bar Plates", hasDecor: true },
  ]);
  assert.equal(plan.groups.length, 1);
  assert.equal(plan.groups[0].name, "Барные стойки");
  assert.equal(plan.groups[0].nameEn, "Bars");
  assert.equal(plan.models[1].name, "Барная стойка с тарелками");
  assert.equal(plan.models[1].nameEn, "Bar Plates");
  assert.equal(plan.models[1].hasDecor, undefined);
});
