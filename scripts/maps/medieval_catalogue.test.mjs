import test from "node:test";
import assert from "node:assert/strict";
import { medievalCatalogue } from "./medieval_catalogue.mjs";
import { currentModel } from "./current_model.mjs";
const model = {
  collection: "medieval-town-vol1",
  sourceCode: "MT1-080",
  sourceName: "Stair Down",
  definitionId: "MT1-080",
  name: "Stair Down",
  code: "MED-stair-down",
  tileType: "stairs",
  width: 1,
  height: 1,
  wallMode: "none",
  wallMask: 0,
  mountDepth: 0.153517,
};
test("a new stair gets bilingual labels and its own family in the existing section", () => {
  const prepared = medievalCatalogue(model, []);
  assert.equal(prepared.name, "Лестница вниз");
  assert.equal(prepared.nameEn, "Stair Down");
  assert.equal(prepared.category, "stairs");
  assert.equal(prepared.code, "MED-stair");
  assert.equal(prepared.variantCode, "MED-stair-down");
  assert.equal(prepared.groupName, "Лестницы");
  assert.equal(prepared.groupNameEn, "Stairs");
  assert.equal(prepared.mountDepth, model.mountDepth);
  assert.equal(prepared.sourceCode, model.sourceCode);
  assert.equal(model.name, "Stair Down");
});
test("publication retains current names, grouping, UUID and user-edited group labels", () => {
  const existing = {
    ...model,
    id: "stable",
    code: "MED-custom-stairs",
    variantCode: "MED-down",
    name: "Спуск",
    nameEn: "Descent",
    category: "stairs",
    groupName: "Переходы",
    groupNameEn: "Connections",
  };
  const result = currentModel(
    medievalCatalogue(model, [existing]),
    [existing],
    {},
  );
  assert.equal(result.id, "stable");
  assert.equal(result.name, "Спуск");
  assert.equal(result.code, existing.code);
  const sibling = {
    ...existing,
    sourceCode: "MT1-079",
    sourceName: "Stair",
    code: "MED-stair",
  };
  assert.equal(medievalCatalogue(model, [sibling]).groupName, "Переходы");
});
