import { expect, it } from "vitest";
import { shadowPrism } from "./shadowGeometry";
it("uses real concave wall outlines instead of a full cell box, at the correct heights", () => {
  const g = shadowPrism(
    [
      [0, 0],
      [1, 0],
      [1, 0.2],
      [0.2, 0.2],
      [0.2, 1],
      [0, 1],
    ],
    0.4,
    1.2,
    1,
    1,
    [0.1, 0],
  );
  g.computeBoundingBox();
  expect(g.boundingBox.min.x).toBeCloseTo(-0.6);
  expect(g.boundingBox.max.y).toBeCloseTo(1.2);
  expect(g.boundingBox.min.y).toBeCloseTo(0.4);
  const positions = g.getAttribute("position");
  let topArea = 0;
  for (let i = 0; i < positions.count; i += 3)
    if (
      [i, i + 1, i + 2].every((j) => Math.abs(positions.getY(j) - 1.2) < 1e-5)
    ) {
      const ax = positions.getX(i + 1) - positions.getX(i),
        az = positions.getZ(i + 1) - positions.getZ(i),
        bx = positions.getX(i + 2) - positions.getX(i),
        bz = positions.getZ(i + 2) - positions.getZ(i);
      topArea += Math.abs(ax * bz - az * bx) / 2;
    }
  expect(topArea).toBeCloseTo(0.36);
  g.dispose();
});
