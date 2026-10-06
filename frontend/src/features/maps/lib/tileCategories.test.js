import { expect, it } from "vitest";
import { TILE_CATEGORIES, matchesTileCategory } from "./tileCategories";
it("filters wall shapes in the same category list as other tile types", () => {
  const models = [
    { id: "floor", tileType: "floor" },
    { id: "straight", tileType: "wall-straight" },
    { id: "angle", tileType: "wall-angle" },
    { id: "corner", tileType: "wall-corner" },
    { id: "diagonal", tileType: "wall-diagonal" },
    { id: "end", tileType: "wall-end" },
    { id: "frame", tileType: "frame" },
    { id: "prop", tileType: "prop" },
  ];
  const ids = (value) =>
    models.filter((m) => matchesTileCategory(m, value)).map((m) => m.id);
  expect(ids("wall")).toEqual([]);
  expect(ids("wall-straight")).toEqual(["straight"]);
  expect(ids("wall-angle")).toEqual(["angle"]);
  expect(ids("wall-custom")).toEqual([]);
  expect(ids("wall-corner")).toEqual(["corner"]);
  expect(ids("wall-diagonal")).toEqual(["diagonal"]);
  expect(ids("wall-end")).toEqual(["end"]);
  expect(ids("floor")).toEqual(["floor"]);
  expect(ids("all")).toEqual([]);
  expect(ids("wall-none")).toEqual([]);
  expect(ids("prop")).toEqual(["prop"]);
  expect(new Set(TILE_CATEGORIES.map((c) => c.value)).size).toBe(
    TILE_CATEGORIES.length,
  );
});
