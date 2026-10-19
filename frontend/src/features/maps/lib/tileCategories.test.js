import { expect, it } from "vitest";
import {
  TILE_CATEGORIES,
  matchesTileCategory,
  isWallTile,
} from "./tileCategories";
it("groups structural wall shapes without conflating water and rail terrain", () => {
  const straight = { tileType: "wall-straight", category: "wall" };
  const angle = { tileType: "wall-angle", category: "wall" };
  const water = { tileType: "wall-angle", category: "water" };
  const railway = { tileType: "wall-angle", category: "railway" };
  expect(
    [straight, angle, water, railway].filter((m) =>
      matchesTileCategory(m, "wall"),
    ),
  ).toEqual([straight, angle]);
  expect(matchesTileCategory(water, "water")).toBe(true);
  expect(matchesTileCategory(railway, "railway")).toBe(true);
  expect(isWallTile(water)).toBe(true);
  for (const value of ["wall-angle", "all", "wall-none", "prop"])
    expect(matchesTileCategory(angle, value)).toBe(false);
  expect(
    TILE_CATEGORIES.map((c) => c.value).filter((v) => v.startsWith("wall")),
  ).toEqual(["wall"]);
});
