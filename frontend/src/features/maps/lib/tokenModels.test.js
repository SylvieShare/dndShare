import { expect, it } from "vitest";
import { tokenItemIds, tokenModelId } from "./tokenModels";
import { withCreatureItems } from "./sessionCreatures";

it("resolves only bestiary tokens through catalogue bindings", () => {
  const models = [{ id: "kobold", itemIds: [1635] }];
  expect(tokenModelId({ kind: "creature", itemId: 1635 }, models)).toBe(
    "kobold",
  );
  for (const token of [
    { kind: "creature", itemId: 1635, dead: true },
    { kind: "player", itemId: 1635 },
    { kind: "creature", itemId: 2 },
    { kind: "creature", itemId: "1635" },
  ])
    expect(tokenModelId(token, models)).toBe("");
  expect(
    tokenItemIds([
      { kind: "creature", itemId: 1635 },
      { kind: "creature", itemId: 1635 },
      { kind: "creature", itemId: 99, dead: true },
      { kind: "marker", itemId: 1 },
    ]),
  ).toEqual([1635]);
});

it("enriches existing placements for rendering without mutating saved state", () => {
  const tokens = [{ kind: "creature", ref: "npc", id: "token" }];
  const result = withCreatureItems(tokens, [
    { kind: "creature", ref: "npc", itemId: 1635 },
  ]);
  expect(result[0].itemId).toBe(1635);
  expect(tokens[0]).not.toHaveProperty("itemId");
});
