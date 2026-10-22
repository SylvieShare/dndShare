import { expect, it } from "vitest";
import { mirrorTileGroup } from "./mapGroupMirror";
import { surfaceCell, surfacePosition } from "./surfacePlacement";
import { structureContext } from "./tileStructure";
const models = [
  {
    id: "frame",
    width: 3,
    height: 2,
    supportSlots: [{ x: 0, y: 0, width: 1, height: 1, elevation: 2 }],
  },
  { id: "floor", width: 1, height: 1 },
];
it("mirrors a whole group and its rotated physical and logical points; two reflections restore it", () => {
  const source = [
    { id: "a", modelId: "frame", x: 2, y: 3, rotation: 90, level: 0 },
    { id: "b", modelId: "floor", x: 7, y: 5, rotation: 0, level: 0 },
  ];
  const mirrored = mirrorTileGroup(source, models),
    p = { x: 0.2, y: 0.4, elevation: 1, cell: { x: 0, y: 0 } };
  const before = surfacePosition(source[0], models[0], p),
    after = surfacePosition(mirrored[0], models[0], p);
  expect(after.x).toBeCloseTo(10 - before.x);
  expect(after.y).toBeCloseTo(before.y);
  const oldCell = surfaceCell(source[0], models[0], p),
    newCell = surfaceCell(mirrored[0], models[0], p);
  expect(newCell).toEqual({ x: 9 - oldCell.x, y: oldCell.y });
  expect(mirrorTileGroup(mirrored, models)).toEqual(
    source.map((t) => ({ ...t, mirrored: false })),
  );
});
it("mirrors asymmetric sockets with their supported upper tiles", () => {
  const document = {
    width: 10,
    height: 10,
    tiles: [
      { id: "base", modelId: "frame", x: 2, y: 3, level: 0, rotation: 0 },
      { id: "upper", modelId: "floor", x: 2, y: 3, level: 1, rotation: 0 },
    ],
  };
  const mirrored = {
    ...document,
    tiles: mirrorTileGroup(document.tiles, models),
  };
  const context = structureContext(mirrored, models);
  expect(context.status.valid).toBe(true);
  expect(context.sockets.has("4,3,1")).toBe(true);
  expect(context.sockets.has("2,3,1")).toBe(false);
});
