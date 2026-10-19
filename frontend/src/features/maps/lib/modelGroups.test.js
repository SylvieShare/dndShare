import { it, expect } from "vitest";
import { modelGroups, modelIdentity, hasModelLight } from "./modelGroups";
it("separates list sections from variant families and keeps standalone tiles distinct", () => {
  const straight = {
    id: "one",
    definitionId: "MED-008",
    code: "MED-ground",
    variantCode: "MED-ground-straight",
    name: "Ground Straight 1",
    collection: "medieval",
  };
  const another = {
    ...straight,
    id: "two",
    definitionId: "MED-009",
    name: "Ground Straight 2",
  };
  const corner = {
    ...straight,
    id: "corner",
    definitionId: "MED-010",
    name: "Ground Corner",
    variantCode: "MED-ground-corner",
  };
  const loose = {
    ...straight,
    id: "loose",
    definitionId: "MED-011",
    name: "Ground Special",
    variantCode: "",
  };
  const sections = modelGroups([straight, another, corner, loose]);
  expect(sections).toHaveLength(1);
  expect(sections[0].name).toBe("Ground");
  expect(
    sections[0].variants.map((family) => family.models.length).sort(),
  ).toEqual([1, 1, 2]);
  expect(
    sections[0].variants
      .find((family) => family.code === straight.variantCode)
      .models.map((m) => m.id),
  ).toEqual(["one", "two"]);
  expect(modelIdentity(straight)).toEqual({
    id: "MED-008",
    code: "MED-ground",
    variantCode: "MED-ground-straight",
    name: straight.name,
  });
});
it("derives a stable heading from the whole group while categories filter its visible members", () => {
  const a = {
    id: "a",
    definitionId: "A",
    code: "MED-bar",
    variantCode: "MED-bar-straight",
    name: "Bar Empty",
    collection: "medieval",
  };
  const b = {
    ...a,
    id: "b",
    definitionId: "B",
    name: "Tall Bar Angle",
    variantCode: "MED-tall-bar-angle",
  };
  expect(modelGroups([b], [a, b])[0].name).toBe("Bar");
  expect(
    modelGroups([a, { ...a, id: "other", collection: "other" }]),
  ).toHaveLength(2);
  expect(
    hasModelLight({ ...a, behaviour: { defaultLights: [{ enabled: false }] } }),
  ).toBe(true);
});
