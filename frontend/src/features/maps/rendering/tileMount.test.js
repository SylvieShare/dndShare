import { expect, it } from "vitest";
import { Vector3 } from "three";
import { tileTransform } from "./tileTransform";
import { structureContext } from "../lib/tileStructure";

it("keeps the body at its datum while the peg inserts below a mounted support", () => {
  const models = [
    {
      id: "support",
      width: 1,
      height: 1,
      mountDepth: 0.15,
      supportSlots: [{ x: 0, y: 0, width: 1, height: 1, elevation: 0.85 }],
    },
    { id: "tile", width: 1, height: 1, mountDepth: 0.2 },
  ];
  const base = {
      id: "base",
      modelId: "support",
      x: 1,
      y: 1,
      level: 0,
      rotation: 0,
    },
    upper = { ...base, id: "upper", modelId: "tile", level: 1 };
  const context = structureContext(
    { width: 4, height: 4, tiles: [upper, base] },
    models,
  );
  const elevation = context.placements.get("upper").elevation;
  expect(elevation).toBeCloseTo(0.7);
  const transform = tileTransform({ ...upper, elevation }, models[1]);
  expect(new Vector3(0, 0.2, 0).applyMatrix4(transform).y).toBeCloseTo(0.7);
  expect(new Vector3(0, 0, 0).applyMatrix4(transform).y).toBeCloseTo(0.5);
});
