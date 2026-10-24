import { expect, it, vi } from "vitest";
import {
  assignTokenBases,
  chooseTokenBase,
  tokenVisualModels,
} from "./tokenBases";

const token = { id: "kobold", kind: "creature", itemId: 1635, size: 1 };
const catalogue = [
  { id: "body", itemIds: [1635], referenceDiameter: 0.9 },
  ...["a", "b"].map((id) => ({
    id,
    category: "creature-base",
    tileType: "object",
    baseSize: 1,
    referenceDiameter: 0.9,
    surfaceHeight: 0.06,
  })),
  {
    id: "large",
    category: "creature-base",
    tileType: "object",
    baseSize: 2,
    referenceDiameter: 1.8,
    surfaceHeight: 0.06,
  },
  { id: "unrelated", category: "object", tileType: "object", baseSize: 1 },
];
it("chooses a fitting base once and preserves the choice through disable/enable and catalogue ordering", () => {
  const random = vi.fn(() => 0.9);
  const state = {
    useCreatureBases: true,
    tokens: [{ ...token }, { ...token, kind: "player", id: "player" }],
  };
  assignTokenBases(state, catalogue, random);
  expect(state.tokens[0].baseModelId).toBe("b");
  expect(state.tokens[1].baseModelId).toBeUndefined();
  state.useCreatureBases = false;
  expect(tokenVisualModels(state.tokens[0], state, catalogue)).toHaveLength(1);
  assignTokenBases(state, catalogue, random);
  state.useCreatureBases = true;
  assignTokenBases(state, [...catalogue].reverse(), random);
  expect(random).toHaveBeenCalledOnce();
  expect(state.tokens[0].baseModelId).toBe("b");
});
it("reselects for a changed size, never uses another size, and plans body and base at one ground datum", () => {
  const large = { ...token, size: 2, elevation: 3, baseModelId: "a" };
  large.baseModelId = chooseTokenBase(large, catalogue);
  expect(large.baseModelId).toBe("large");
  const [body, base] = tokenVisualModels(
    large,
    { useCreatureBases: true },
    catalogue,
  );
  expect(body).toMatchObject({
    modelId: "body",
    scale: 1.7 / 0.9,
    elevation: 3.06,
  });
  expect(base).toMatchObject({
    modelId: "large",
    scale: 1.7 / 1.8,
    elevation: 3,
  });
  expect(chooseTokenBase({ ...token, size: 8 }, catalogue)).toBe("");
  expect(
    tokenVisualModels(
      { ...token, kind: "player" },
      { useCreatureBases: true },
      catalogue,
    ),
  ).toEqual([]);
});
