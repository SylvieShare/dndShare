import { afterEach, expect, it, vi } from "vitest";
import { Raycaster, Scene, Vector3 } from "three";
import { createCameraMarkers } from "./mapCameraMarkers";
import { worldVector } from "./sceneCameraView";

afterEach(() => vi.unstubAllGlobals());
const camera = {
  id: "camera",
  name: "Вход",
  view: {
    position: [3, 2, 4],
    target: [6, 5, 0.44],
    up: [0, 0, 1],
    width: 12,
    aspect: 1.6,
  },
};
const document = { kind: "tiles", cameras: [camera] };
const rayAt = (point) =>
  new Raycaster(
    worldVector(point).add(new Vector3(0, 10, 0)),
    new Vector3(0, -1, 0),
  );

it("picks the body and target independently and leaves broadcast cameras read-only", () => {
  const markers = createCameraMarkers(new Scene());
  markers.update(document, { editCameras: true });
  expect(markers.pick(rayAt(camera.view.position))).toMatchObject({
    cameraId: "camera",
    cameraPart: "body",
  });
  expect(markers.pick(rayAt(camera.view.target))).toMatchObject({
    cameraId: "camera",
    cameraPart: "target",
  });
  markers.update(
    { kind: "tiles", cameras: [] },
    { editCameras: true, broadcastView: camera.view },
  );
  expect(markers.pick(rayAt(camera.view.target))).toBeNull();
  markers.update(document, { editCameras: false });
  expect(markers.pick(rayAt(camera.view.position))).toBeNull();
  markers.update(document, { editCameras: true, master: false });
  expect(markers.root.visible).toBe(false);
  markers.destroy();
});

it("highlights only the hovered part, keeps black model edges and reuses its geometry", () => {
  const markers = createCameraMarkers(new Scene());
  markers.update(document, { editCameras: true });
  const record = markers.root.children[0],
    body = record.children[0],
    focus = record.children[1];
  const material = body.children[0].material,
    original = material.color.getHex();
  const geometry = body.children[0].geometry;
  markers.update(document, {
    editCameras: true,
    hoveredCamera: camera.id,
    hoveredCameraPart: "target",
  });
  expect(markers.advance(1000)).toBe(true);
  expect(material.color.getHex()).toBe(original);
  expect(focus.children[1].material.color.getHex()).toBe(0xffffff);
  expect(markers.root.children[0]).toBe(record);
  expect(body.children[0].geometry).toBe(geometry);
  const edges = body.children.filter((node) => node.isLineSegments);
  expect(edges).toHaveLength(2);
  expect(edges.every((node) => node.material.color.getHex() === 0x000000)).toBe(
    true,
  );
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
  markers.update(document, {
    editCameras: true,
    hoveredCamera: camera.id,
    hoveredCameraPart: "body",
  });
  expect(material.color.getHex()).toBe(0xffffff);
  expect(focus.children[1].material.color.getHex()).toBe(original);
  markers.destroy();
});

it("updates target previews in place and releases deleted marker materials", () => {
  const markers = createCameraMarkers(new Scene());
  markers.update(document, { editCameras: true });
  const record = markers.root.children[0],
    body = record.children[0],
    focus = record.children[1];
  const dispose = vi.spyOn(body.children[0].material, "dispose");
  markers.update(document, {
    editCameras: true,
    selectedCamera: camera.id,
    draggingCameraPart: "target",
    previewCamera: { ...camera, view: { ...camera.view, target: [8, 4, 2] } },
  });
  expect(record.children[1]).toBe(focus);
  expect(focus.position.toArray()).toEqual([8, 2, 4]);
  expect(body.position.toArray()).toEqual([3, 4, 2]);
  expect(focus.children[0].visible).toBe(true);
  markers.update({ ...document, cameras: [] }, { editCameras: true });
  expect(markers.root.children).toHaveLength(0);
  expect(dispose).toHaveBeenCalledOnce();
  markers.destroy();
});

it("fades hidden camera markers but stops hit testing them immediately", () => {
  const markers = createCameraMarkers(new Scene());
  markers.update(document, { editCameras: true });
  const material = markers.root.children[0].children[0].children[0].material;
  markers.update(document, { editCameras: false });
  expect(markers.pick(rayAt(camera.view.position))).toBeNull();
  expect(markers.advance(110)).toBe(true);
  expect(material.opacity).toBeGreaterThan(0);
  expect(material.opacity).toBeLessThan(1);
  markers.advance(220);
  expect(markers.root.visible).toBe(false);
  markers.update(document, { editCameras: true });
  markers.advance(220);
  expect(material.opacity).toBe(1);
  expect(markers.pick(rayAt(camera.view.position))).toBeTruthy();
  markers.destroy();
});
