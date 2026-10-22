import {
  BoxGeometry,
  BufferGeometry,
  CylinderGeometry,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  SphereGeometry,
} from "three";
import { cameraFrame, worldVector } from "./sceneCameraView";
export function createCameraMarkers(scene) {
  const root = new Group();
  scene.add(root);
  let key = "";
  function clear() {
    root.traverse((o) => {
      o.geometry?.dispose();
      if (o.material) o.material.dispose();
    });
    root.clear();
  }
  return {
    root,
    update(document, options) {
      const values = (document.cameras || []).map((c) =>
        options.previewCamera?.id === c.id ? options.previewCamera : c,
      );
      if (
        options.previewCamera &&
        !values.some((c) => c.id === options.previewCamera.id)
      )
        values.push(options.previewCamera);
      if (options.broadcastView)
        values.push({
          id: "virtual-camera",
          view: options.broadcastView,
          virtual: true,
        });
      const next = JSON.stringify([
        options.editCameras,
        options.selectedCamera,
        values,
      ]);
      if (next === key) return;
      key = next;
      clear();
      root.visible = !!options.editCameras && document.kind === "tiles";
      if (!root.visible) return;
      for (const c of values) {
        const colour = c.virtual
          ? 0x43d3db
          : c.id === options.selectedCamera
            ? 0xa78bfa
            : 0xf6b451;
        const target = worldVector(c.view.target),
          position = worldVector(c.view.position);
        if (c.virtual)
          position
            .copy(target)
            .add(
              worldVector(c.view.position)
                .sub(target)
                .normalize()
                .multiplyScalar(4),
            );
        const body = new Group();
        body.position.copy(position);
        body.lookAt(target);
        const material = new MeshBasicMaterial({ color: colour });
        const box = new Mesh(new BoxGeometry(0.38, 0.26, 0.3), material);
        body.add(box);
        const lens = new Mesh(
          new CylinderGeometry(0.1, 0.14, 0.22, 12),
          material.clone(),
        );
        lens.rotation.x = Math.PI / 2;
        lens.position.z = 0.22;
        body.add(lens);
        if (!c.virtual) body.userData.cameraId = c.id;
        root.add(body);
        const corners = cameraFrame(c.view),
          points = [];
        for (const p of corners) points.push(position, p);
        for (const [a, b] of [
          [0, 1],
          [1, 3],
          [3, 2],
          [2, 0],
        ])
          points.push(corners[a], corners[b]);
        const lines = new LineSegments(
          new BufferGeometry().setFromPoints(points),
          new LineBasicMaterial({
            color: colour,
            transparent: true,
            opacity: c.id === options.selectedCamera || c.virtual ? 0.85 : 0.35,
            depthWrite: false,
          }),
        );
        lines.raycast = () => {};
        root.add(lines);
        const focus = new Mesh(
          new SphereGeometry(0.08, 10, 8),
          material.clone(),
        );
        focus.position.copy(target);
        focus.raycast = () => {};
        root.add(focus);
      }
    },
    pick(ray) {
      for (const hit of ray.intersectObject(root, true)) {
        let n = hit.object;
        while (n) {
          if (n.userData.cameraId)
            return { cameraId: n.userData.cameraId, distance: hit.distance };
          n = n.parent;
        }
      }
      return null;
    },
    destroy() {
      clear();
      scene.remove(root);
    },
  };
}
