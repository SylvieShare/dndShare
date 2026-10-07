import { expect, it } from "vitest";
import {
  groupMapEntities,
  mapEntity,
  selectedMapEntities,
} from "./editorEntities";
const catalogue = [
  {
    id: "floor",
    name: "Пол",
    sourceCode: "F-1",
    definitionId: "F-1",
    sourceName: "Floor",
    previewUrl: "/floor.webp",
    width: 1,
    height: 1,
    surfaceHeight: 0.4,
    mountDepth: 0.1,
    maxHeight: 0.4,
    supportSlots: [],
  },
  {
    id: "chest",
    name: "Сундук",
    sourceCode: "O-1",
    definitionId: "O-1",
    sourceName: "Chest",
    width: 1,
    height: 1,
    maxHeight: 0.6,
  },
];
const document = {
  width: 8,
  height: 8,
  tiles: [
    { id: "a", modelId: "floor", x: 1, y: 2, level: 0, rotation: 0 },
    { id: "b", modelId: "floor", x: 2, y: 2, level: 0, rotation: 0 },
  ],
  objects: [
    {
      id: "chest-1",
      modelId: "chest",
      x: 1.5,
      y: 2.5,
      elevation: 1,
      rotation: 90,
      scale: 1,
    },
  ],
  areas: [{ id: "room", name: "Зал", tileIds: ["a"], objectIds: [] }],
  lights: [
    {
      id: "lamp",
      name: "Факел",
      kind: "torch",
      color: "#ffaa44",
      height: 0.8,
      anchor: { kind: "tile", id: "a" },
      offset: [0, 0],
    },
  ],
};
it("summarizes repeated tile models separately from objects without losing their instances", () => {
  const entries = selectedMapEntities({
    draft: { document },
    catalogue,
    selectedTiles: ["a", "b"],
    selectedObjects: ["chest-1"],
    selectedLight: "",
  });
  const groups = groupMapEntities(entries);
  expect(entries).toHaveLength(3);
  expect(groups.map((g) => [g.kind, g.count])).toEqual([
    ["tile", 2],
    ["object", 1],
  ]);
  expect(groups[0].members.map((m) => m.id)).toEqual(["a", "b"]);
  expect(entries[2]).toMatchObject({
    name: "Сундук",
    code: "O-1",
    position: { x: 1.5, y: 2.5, elevation: 1 },
  });
});
it("shows a light's inherited area and actual height above its support", () => {
  const entry = mapEntity(document, catalogue, "light", "lamp");
  expect(entry.areaName).toBe("Зал");
  expect(entry.position).toEqual({ x: 1.5, y: 2.5, elevation: 1.1 });
  expect(mapEntity(document, catalogue, "tile", "removed")).toBeNull();
});
