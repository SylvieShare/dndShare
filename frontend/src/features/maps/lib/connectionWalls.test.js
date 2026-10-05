import { expect, it } from "vitest";
import { connectionWallShapes } from "./connectionWalls";
it("provides filled wall faces across the complete side with a broad clickable height", () => {
  const points = [
    { x: 50, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 50 },
    { x: 100, y: 100 },
    { x: 50, y: 100 },
    { x: 0, y: 100 },
    { x: 0, y: 50 },
    { x: 0, y: 0 },
  ];
  const walls = connectionWallShapes(points);
  expect(walls.map((w) => w.index)).toEqual([0, 2, 4, 6]);
  const front = walls[0].front.split(" ").map((p) => p.split(",").map(Number));
  expect(
    Math.max(...front.map((p) => p[0])) - Math.min(...front.map((p) => p[0])),
  ).toBe(100);
  expect(
    Math.max(...front.map((p) => p[1])) - Math.min(...front.map((p) => p[1])),
  ).toBeGreaterThanOrEqual(18);
  expect(walls.every((w) => w.front && w.top && w.side)).toBe(true);
});
