import { expect, it } from "vitest";
import { TILE_CATEGORIES, matchesTileCategory } from "./tileCategories";
it("filters wall shapes in the same category list as other tile types", () => {
  const models = [
    { id: "floor", tileType: "floor" },
    { id: "straight", tileType: "wall-straight" },
    { id: "angle", tileType: "wall-angle" },
    { id: "arch", tileType: "wall-custom" },
    { id: "unknown", tileType: "wall-custom" },
    { id: "frame", tileType: "frame" },
    { id: "prop", tileType: "prop" },
  ];
  const ids = (value) =>
    models.filter((m) => matchesTileCategory(m, value)).map((m) => m.id);
  expect(ids("wall")).toEqual(["straight", "angle", "arch", "unknown"]);
  expect(ids("wall-straight")).toEqual(["straight"]);
  expect(ids("wall-angle")).toEqual(["angle"]);
  expect(ids("wall-custom")).toEqual(["arch", "unknown"]);
  expect(ids("floor")).toEqual(["floor"]);
  expect(ids("all")).toEqual([]);
  expect(ids("wall-none")).toEqual([]);
  expect(ids("prop")).toEqual(["prop"]);
  expect(new Set(TILE_CATEGORIES.map((c) => c.value)).size).toBe(
    TILE_CATEGORIES.length,
  );
});
