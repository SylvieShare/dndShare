import { expect, it } from "vitest";
import { groupRotationPivot, rotateMapGroup } from "./mapGroupRotation";
const models = [
  { id: "wide", width: 2, height: 1 },
  { id: "floor", width: 1, height: 1 },
];
it("rotates wide footprints, objects and levels together and returns exactly after four turns", () => {
  const tiles = [
    { id: "base", modelId: "wide", x: 2, y: 2, level: 0, rotation: 0 },
    { id: "upper", modelId: "floor", x: 2, y: 2, level: 1, rotation: 0 },
  ];
  const objects = [{ id: "prop", x: 3.5, y: 2.5, rotation: 270 }];
  const pivot = groupRotationPivot(tiles, objects, models);
  let result = { tiles, objects };
  for (let i = 0; i < 4; i++)
    result = rotateMapGroup(result.tiles, result.objects, models, pivot);
  expect(result).toEqual({ tiles, objects });
  const turned = rotateMapGroup(tiles, objects, models, pivot);
  expect(turned.tiles[0].x).toBe(turned.tiles[1].x);
  expect(turned.tiles.map((t) => t.level)).toEqual([0, 1]);
  expect(
    turned.tiles.every((t) => Number.isInteger(t.x) && Number.isInteger(t.y)),
  ).toBe(true);
  expect(turned.objects[0].rotation).toBe(0);
});
