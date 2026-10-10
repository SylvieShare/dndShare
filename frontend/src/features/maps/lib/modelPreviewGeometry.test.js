import { describe, expect, it } from "vitest";
import { Vector3 } from "three";
import { tileTransform } from "../rendering/tileTransform";
import {
  layoutPreviewLabels,
  previewGeometry,
  previewPorts,
  previewSockets,
  setGeometryValue,
} from "./modelPreviewGeometry";

const model = {
  width: 3,
  height: 2,
  mountDepth: 0.3,
  surfaceHeight: 0.5,
  maxHeight: 1.4,
  placementOffset: [0.4, -0.25],
  wallMode: "center",
  wallMask: 5,
  supportSlots: [{ x: 0, y: 1, width: 2, height: 1, elevation: 1.2 }],
};
describe("model reference geometry", () => {
  it("clears an insertion profile when the model no longer has a mounting part", () => {
    const draft = { ...model, mountProfile: "xl-ring" };
    setGeometryValue(draft, "mountDepth", 0);
    expect(draft.mountProfile).toBe("");
  });
  it("validates profile rises without moving the physical slot markers", () => {
    const frame = { ...model, tileType: "frame", supportSlots: [{ ...model.supportSlots[0], insertionRises: { "xl-ring": .08, "db-pins": .1 } }] };
    expect(previewSockets(frame)[0]).toEqual(previewSockets(model)[0]);
    for (const rises of [{ "bad profile": .05 }, { "xl-ring": -.01 }, { "xl-ring": .101 }, { "xl-ring": NaN }]) {
      frame.supportSlots[0].insertionRises = rises;
      expect(previewSockets(frame)[0].valid).toBe(false);
    }
    frame.supportSlots[0].insertionRises = { "xl-ring": .08 };
    frame.tileType = "floor";
    expect(previewSockets(frame)[0].valid).toBe(false);
  });
  it("keeps a measured insertion rise separate from the physical rim sphere", () => {
    const grid = {
      ...model,
      tileType: "frame",
      supportSlots: [{ ...model.supportSlots[0], insertionRise: 2 / 35 }],
    };
    expect(previewSockets(grid)[0]).toEqual(previewSockets(model)[0]);
    expect(previewSockets({ ...grid, tileType: "floor" })[0].valid).toBe(false);
    grid.supportSlots[0].insertionRise = 0.101;
    expect(previewSockets(grid)[0].valid).toBe(false);
  });
  it("uses the map's actual body datum and mesh offsets for height annotations", () => {
    const g = previewGeometry(model),
      transform = tileTransform({ x: 0, y: 0, rotation: 0 }, model);
    const surface = new Vector3(0, model.surfaceHeight, 0).applyMatrix4(
      transform,
    );
    expect(surface.y).toBeCloseTo(g.surface);
    expect(surface.x).toBeCloseTo(1.9);
    expect(surface.z).toBeCloseTo(0.75);
    expect(g.bottom).toBeCloseTo(-0.3);
    expect(g.top).toBeCloseTo(1.1);
  });
  it("raises eight points or four sides above both the mesh and declared top", () => {
    const ports = previewPorts(model, 2);
    expect(ports).toHaveLength(8);
    expect(ports.every((p) => p.position[1] === 2.24)).toBe(true);
    expect(
      previewPorts({ ...model, wallMode: "edge" }).map((p) => p.index),
    ).toEqual([0, 2, 4, 6]);
    expect(previewPorts({ ...model, wallMode: "none" })).toEqual([]);
    expect(ports.filter((p) => p.active).map((p) => p.index)).toEqual([0, 2]);
  });
  it("keeps slots on their logical cells while translating the mesh, with one sphere per cell", () => {
    const slots = previewSockets(model);
    expect(slots).toHaveLength(2);
    expect(slots.map((p) => p.position[0])).toEqual([0.5, 1.5]);
    expect(slots.every((p) => p.valid && p.position[2] === 1.5)).toBe(true);
    expect(slots[0].position[1]).toBeCloseTo(0.935);
    const invalid = previewSockets({
      ...model,
      supportSlots: [{ x: NaN, y: 0, width: 1, height: 1, elevation: NaN }],
    });
    expect(invalid[0].valid).toBe(false);
    expect(invalid[0].position.every(Number.isFinite)).toBe(true);
  });
  it("keeps projected measurement labels apart and inside the viewport", () => {
    const labels = layoutPreviewLabels(
      Array.from({ length: 5 }, (_, key) => ({ key, x: 10, y: 190 })),
      300,
      200,
    );
    expect(
      labels.every((p) => p.x >= 72 && p.x <= 228 && p.y >= 18 && p.y <= 182),
    ).toBe(true);
    expect(labels.slice(1).every((p, i) => p.y - labels[i].y >= 30)).toBe(true);
  });
});
