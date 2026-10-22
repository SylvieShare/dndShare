import { expect, it } from "vitest";
import {
  surfacePosition,
  surfacePoints,
  syncSurfaceObjects,
} from "./surfacePlacement";
it("rotates raised surfaces, subtracts the insertion peg and follows parent tiles", () => {
  const model = {
    id: "floor",
    width: 3,
    height: 1,
    mountDepth: 0.2,
    canStand: true,
    placementPoints: [{ cell: { x: 0, y: 0 }, x: 0.5, y: 0.5, elevation: 0.8 }],
    supportSlots: [],
  };
  const tile = {
    id: "parent",
    modelId: "floor",
    x: 2,
    y: 3,
    rotation: 90,
    level: 0,
  };
  expect(surfacePosition(tile, model, model.placementPoints[0], 1)).toEqual({
    x: 2.5,
    y: 3.5,
    elevation: 1.6,
  });
  const document = {
    width: 10,
    height: 10,
    tiles: [tile],
    objects: [
      {
        id: "chest",
        modelId: "object",
        x: 0,
        y: 0,
        placement: { tileId: "parent", point: 0 },
      },
    ],
  };
  syncSurfaceObjects(document, [model]);
  expect(document.objects[0]).toMatchObject({ x: 2.5, y: 3.5 });
  expect(surfacePoints(document, [model])).toEqual([]);
  expect(surfacePoints(document, [model], "chest")).toHaveLength(1);
  document.tiles = [];
  syncSurfaceObjects(document, [model]);
  expect(document.objects).toEqual([]);
});
it("logical cell rotates independently of the physical surface point", async () => {
  const { surfaceCell } = await import("./surfacePlacement");
  const model = { width: 3, height: 2 };
  const point = { x: 0.25, y: 0.3, elevation: 2, cell: { x: 2, y: 0 } };
  expect(
    [0, 90, 180, 270].map((rotation) =>
      surfaceCell({ x: 5, y: 4, rotation }, model, point),
    ),
  ).toEqual([
    { x: 7, y: 4 },
    { x: 6, y: 6 },
    { x: 5, y: 5 },
    { x: 5, y: 4 },
  ]);
});
