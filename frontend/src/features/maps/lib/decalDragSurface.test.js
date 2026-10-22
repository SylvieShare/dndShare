import { expect, it } from "vitest";
import { dragDecalSurface } from "./decalDragSurface";

it("keeps the grabbed image coordinate when moving a rotated floor decal to a wall", () => {
  const decal = {
    anchor: { kind: "tile", id: "floor" },
    position: [0, 0, 0],
    normal: [0, 1, 0],
    rotation: 90,
  };
  const grab = { position: [0.2, 0, 0.3] };
  const target = {
    anchor: { kind: "object", id: "wall" },
    position: [1, 2, 3],
    normal: [0, 0, 1],
  };
  const moved = dragDecalSurface(decal, grab, target);
  expect(moved.anchor).toEqual(target.anchor);
  expect(moved.normal).toEqual(target.normal);
  moved.position.forEach((value, i) =>
    expect(value).toBeCloseTo([0.8, 2.3, 3][i]),
  );
  expect(dragDecalSurface(decal, grab, null)).toBeNull();
});
