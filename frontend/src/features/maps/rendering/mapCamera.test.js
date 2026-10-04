import { describe, expect, it } from "vitest";
import { OrthographicCamera, Vector3 } from "three";
import { mapCamera } from "./mapCamera";
import { FLOOR } from "./annotations";
import { newMap } from "../lib/mapModel";

function setup() {
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0.01, 2000);
  const host = { clientWidth: 1000, clientHeight: 800 };
  const gpu = {
    setSize() {},
    domElement: { getBoundingClientRect: () => ({ left: 20, top: 30, width: 1000, height: 800 }) },
  };
  const view = mapCamera(camera, gpu, host, () => {});
  const document = newMap().document;
  view.document(document, {});
  function project(point) {
    const p = point.clone().project(camera);
    return { clientX: 20 + (p.x + 1) * 500, clientY: 30 + (1 - p.y) * 400 };
  }
  return { camera, view, document, project };
}

describe("map camera", () => {
  it("opens in isometry with equal foreshortening on all three axes", () => {
    const { view, project } = setup();
    const { x, y } = view.getView();
    const origin = new Vector3(x, FLOOR, y), center = project(origin);
    const axes = [new Vector3(1, 0, 0), new Vector3(0, 1, 0), new Vector3(0, 0, 1)];
    const lengths = axes.map((axis) => {
      const p = project(origin.clone().add(axis));
      return Math.hypot(p.clientX - center.clientX, p.clientY - center.clientY);
    });
    expect(lengths[0]).toBeCloseTo(lengths[1], 8);
    expect(lengths[0]).toBeCloseTo(lengths[2], 8);
    const a = project(origin.clone().add(axes[0])), b = project(origin.clone().add(axes[2]));
    expect(a.clientX - center.clientX).toBeCloseTo(center.clientX - b.clientX, 8);
    expect(a.clientY).toBeCloseTo(b.clientY, 8);
  });

  it("picks the same world cell after orbit, zoom and document redraw", () => {
    const { view, document, project } = setup();
    const target = new Vector3(4.5, FLOOR, 6.5);
    for (const pose of [{}, { azimuth: 123, tilt: 27, cellPixels: 85, fit: false }, { azimuth: 0, tilt: 90 }]) {
      view.update(pose);
      const before = view.getView();
      view.document(document, {});
      expect(view.getView()).toEqual(before);
      const hit = view.world(project(target));
      expect(hit.x).toBeCloseTo(target.x, 8);
      expect(hit.y).toBeCloseTo(target.z, 8);
    }
  });

  it("keeps a calibrated tabletop directly overhead through quarter turns", () => {
    const { view, camera, document, project } = setup();
    view.document(document, { tabletop: true });
    const origin = new Vector3(4, FLOOR, 4);
    for (const rotation of [0, 90, 180, 270]) {
      view.update({ x: 4, y: 4, rotation, fit: false, cellPixels: 64, tilt: 30, azimuth: 45 });
      const a = project(origin), b = project(origin.clone().add(new Vector3(1, 0, 0)));
      expect(Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY)).toBeCloseTo(64, 8);
      expect(camera.position.x).toBeCloseTo(4, 8);
      expect(camera.position.z).toBeCloseTo(4, 8);
    }
  });
});
