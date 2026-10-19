import { it, expect } from "vitest";
import { modelGroups, modelIdentity, hasModelLight } from "./modelGroups";
const base = {
  id: "one",
  definitionId: "MT1-001",
  collection: "medieval",
  code: "MED-bar",
  variantCode: "MED-bar-straight",
  name: "Пустая барная стойка",
  groupName: "Барные стойки",
  groupNameEn: "Bars",
  tileType: "floor",
  hasDecor: false,
};
it("keeps free and furnished variants together as flat neighbouring cards", () => {
  const second = {
    ...base,
    id: "two",
    definitionId: "MT1-002",
    hasDecor: true,
    name: "Барная стойка с тарелками",
  };
  const corner = { ...base, id: "corner", variantCode: "MED-bar-angle" };
  const groups = modelGroups([base, second, corner]);
  expect(groups).toHaveLength(1);
  expect(groups[0].name).toBe("Барные стойки");
  expect(groups[0].models.map((m) => m.id)).toEqual(["corner", "one", "two"]);
  expect(groups[0].subsections[0].models).toHaveLength(3);
  expect(groups[0]).not.toHaveProperty("variants");
  expect(modelGroups([second])[0].name).toBe("Барные стойки");
  expect(modelIdentity(base)).toEqual({
    id: base.definitionId,
    code: base.code,
    variantCode: base.variantCode,
    name: base.name,
  });
});
it("subdivides walls by structural shape within their shared section", () => {
  const wall = {
    ...base,
    code: "MED-wall",
    groupName: "Стены",
    tileType: "wall-straight",
  };
  const angle = { ...wall, id: "angle", tileType: "wall-angle" };
  const section = modelGroups([wall, angle], { wallSubcategories: true })[0];
  expect(section.subsections.map((s) => s.name)).toEqual([
    "Прямые стены",
    "Внутренние углы",
  ]);
  expect(
    modelGroups([base, { ...base, id: "other", collection: "other" }]),
  ).toHaveLength(2);
  expect(
    hasModelLight({
      ...base,
      behaviour: { defaultLights: [{ enabled: false }] },
    }),
  ).toBe(true);
});
