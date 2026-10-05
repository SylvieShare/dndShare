import { describe, expect, it } from "vitest";
import { structureContext, rotatedSlot, dependentTiles } from "./tileStructure";
import { tileGroupStatus } from "./tilePlacement";
const models = [
  {
    id: "frame",
    width: 2,
    height: 1,
    supportSlots: [{ x: 0, y: 0, width: 2, height: 1, elevation: 1 }],
  },
  { id: "floor", width: 1, height: 1, supportSlots: [] },
  { id: "wide", width: 2, height: 1, supportSlots: [] },
];
const frame = {
  id: "base",
  modelId: "frame",
  x: 1,
  y: 1,
  rotation: 0,
  level: 0,
};
const floor = {
  id: "above",
  modelId: "floor",
  x: 1,
  y: 1,
  rotation: 0,
  level: 1,
};
const doc = (tiles) => ({ width: 8, height: 8, tiles });
it("rejects floating tiles and allows one supporting cell under an overhang", () => {
  expect(tileGroupStatus(doc([]), [floor], models).valid).toBe(false);
  expect(tileGroupStatus(doc([frame]), [floor], models).valid).toBe(true);
  expect(
    tileGroupStatus(doc([frame]), [{ ...floor, modelId: "wide", x: 2 }], models)
      .valid,
  ).toBe(true);
  expect(
    tileGroupStatus(doc([frame]), [{ ...floor, modelId: "wide", x: 3 }], models)
      .valid,
  ).toBe(false);
});
it("rests a three-cell bridge on the highest available support and keeps full-footprint collisions", () => {
  const catalogue = [
    ...models,
    { id: "bridge", width: 3, height: 1 },
    {
      id: "high",
      width: 1,
      height: 1,
      supportSlots: [{ x: 0, y: 0, width: 1, height: 1, elevation: 1.5 }],
    },
  ];
  const low = { ...frame, id: "low", x: 1 },
    high = { ...frame, id: "high", modelId: "high", x: 4 };
  const bridge = { ...floor, modelId: "bridge", x: 2 };
  const context = structureContext(doc([bridge, low, high]), catalogue);
  expect(context.status.valid).toBe(true);
  expect(context.placements.get(bridge.id)).toMatchObject({
    elevation: 1.5,
    supports: ["high"],
  });
  expect(
    tileGroupStatus(
      doc([low, high, bridge]),
      [{ ...bridge, id: "overlap", x: 3 }],
      catalogue,
    ).valid,
  ).toBe(false);
});
it("resolves actual socket heights in any document order", () => {
  const context = structureContext(doc([floor, frame]), models);
  expect(context.status.valid).toBe(true);
  expect(context.placements.get("above")).toMatchObject({
    elevation: 1,
    supports: ["base"],
  });
});
it("rotates asymmetric slot positions and carries dependent upper tiles", () => {
  expect(
    rotatedSlot(
      { x: 1, y: 0, width: 1, height: 1, elevation: 1 },
      models[0],
      90,
    ),
  ).toMatchObject({ x: 0, y: 1, width: 1, height: 1 });
  expect(dependentTiles(doc([frame, floor]), models, ["base"])).toEqual([
    "base",
    "above",
  ]);
  expect(
    tileGroupStatus(doc([frame, floor]), [{ ...frame, x: 4 }], models).valid,
  ).toBe(false);
});
