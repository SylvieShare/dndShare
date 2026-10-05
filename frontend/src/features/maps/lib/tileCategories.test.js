import { expect, it } from "vitest";
import { TILE_CATEGORIES, matchesTileCategory } from "./tileCategories";
it("filters wall shapes in the same category list as other tile types", () => {
  const models = [
    { id: "floor", tileType: "floor", wallLayout: "none" },
    { id: "straight", tileType: "wall", wallLayout: "straight" },
    { id: "angle", tileType: "wall", wallLayout: "angle" },
    { id: "arch", tileType: "wall", wallLayout: "custom" },
    { id: "unknown", tileType: "wall", wallLayout: "arched-door" },
    { id: "frame", tileType: "frame", wallLayout: "none" },
    { id: "prop", tileType: "prop", wallLayout: "straight" },
  ];
  const ids = (value) =>
    models.filter((m) => matchesTileCategory(m, value)).map((m) => m.id);
  expect(ids("wall")).toEqual(["straight", "angle", "arch", "unknown"]);
  expect(ids("wall-straight")).toEqual(["straight"]);
  expect(ids("wall-angle")).toEqual(["angle"]);
  expect(ids("wall-custom")).toEqual(["arch", "unknown"]);
  expect(ids("wall-none")).toEqual(["floor", "frame"]);
  expect(ids("prop")).toEqual(["prop"]);
  expect(new Set(TILE_CATEGORIES.map((c) => c.value)).size).toBe(
    TILE_CATEGORIES.length,
  );
});
