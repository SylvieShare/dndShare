import { expect, it, vi } from "vitest";
import { modelPreviewGuides } from "./modelPreviewGuides";

it("keeps placement sphere geometry alive and finite while editing incomplete coordinates", () => {
  const guides = modelPreviewGuides();
  const model = {
    width: 1,
    height: 1,
    mountDepth: 0.2,
    surfaceHeight: 0.5,
    maxHeight: 1,
    placementOffset: [0, 0],
    wallMode: "none",
    wallMask: 0,
    supportSlots: [],
    canStand: true,
    placementPoints: [{ x: 0.5, y: 0.5, elevation: 0.5 }],
  };
  guides.update(model, { max: { y: 1 } }, {});
  const sphere = guides.root.children.find((n) => n.userData.point === 0);
  expect(sphere.position.y).toBeCloseTo(0.335);
  const dispose = vi.spyOn(sphere.geometry, "dispose");
  model.placementPoints[0].x = NaN;
  guides.update(model, { max: { y: 1 } }, { selectedPoint: 0 });
  expect(dispose).toHaveBeenCalledOnce();
  const invalid = guides.root.children.find((n) => n.userData.point === 0);
  expect(invalid.position.toArray().every(Number.isFinite)).toBe(true);
  expect(invalid.material.color.getHex()).toBe(0xec7777);
  guides.destroy();
});
