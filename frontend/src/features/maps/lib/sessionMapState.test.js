import { expect, it } from "vitest";
import { normalizeSessionMap } from "./sessionMapState";
import { newMap, initialState } from "./mapModel";
it("scene edits move attached creatures and prune removed links without changing surviving HP references", () => {
  const map = newMap();
  map.state = initialState();
  const model = {
    id: "floor",
    width: 1,
    height: 1,
    mountDepth: 0,
    surfaceHeight: 0.4,
    placementPoints: [{ x: 0.5, y: 0.5, elevation: 0.4 }],
    supportSlots: [],
    canStand: true,
  };
  map.document.tiles = [
    { id: "base", modelId: "floor", x: 4, y: 5, rotation: 0, level: 0 },
  ];
  map.state.tokens = [
    {
      id: "hero",
      kind: "player",
      ref: "41",
      x: 1.5,
      y: 1.5,
      placement: { tileId: "base", point: 0 },
    },
    { id: "removed", placement: { tileId: "gone", point: 0 }, x: 1, y: 1 },
  ];
  map.state.objects = { deleted: true };
  map.state.zones = { deleted: "visible" };
  normalizeSessionMap(map, [model]);
  expect(map.state.tokens).toEqual([
    {
      id: "hero",
      kind: "player",
      ref: "41",
      x: 4.5,
      y: 5.5,
      placement: { tileId: "base", point: 0 },
    },
  ]);
  expect(map.state.objects).toEqual({});
  expect(map.state.zones).toEqual({});
});
