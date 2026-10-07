import { it, expect } from "vitest";
import { modelGroups, modelIdentity, hasModelLight } from "./modelGroups";
it("groups distinct element and version IDs by code, sorts codes and retains all variants", () => {
  const door = {
    id: "version-1",
    definitionId: "UD-010",
    code: "UD-door",
    name: "Door",
    collection: "ud",
  };
  const open = {
    ...door,
    id: "version-2",
    definitionId: "UD-010-OPEN",
    name: "Door open",
  };
  const floor = {
    ...door,
    id: "floor",
    definitionId: "UD-016",
    code: "UD-ground",
    name: "Ground 1",
  };
  const groups = modelGroups([floor, open, door]);
  expect(groups.map((g) => g.code)).toEqual(["UD-door", "UD-ground"]);
  expect(groups[0].models.map((m) => m.definitionId)).toEqual([
    "UD-010",
    "UD-010-OPEN",
  ]);
  expect(modelIdentity(open)).toEqual({
    id: "UD-010-OPEN",
    code: "UD-door",
    name: "Door open",
  });
});
it("keeps pack scope and marks embedded sources even if switched off by default", () => {
  const m = {
    id: "v",
    definitionId: "UD-037",
    collection: "ud",
    code: "UD-torch",
    behaviour: { defaultLights: [{ enabled: false }] },
  };
  expect(hasModelLight(m)).toBe(true);
  expect(hasModelLight({ ...m, behaviour: { defaultLights: [] } })).toBe(false);
  expect(
    modelGroups([m, { ...m, id: "other", collection: "other" }]),
  ).toHaveLength(2);
});
