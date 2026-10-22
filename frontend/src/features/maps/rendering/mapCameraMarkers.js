import { Color, Group } from "three";
import { cameraFrame, worldVector } from "./sceneCameraView";
import { createCameraMarkerGeometry } from "./cameraMarkerGeometry";
import { createScalarMotion, reducedMapMotion } from "./scalarMotion";

export function createCameraMarkers(scene) {
  const root = new Group(),
    records = new Map(),
    geometry = createCameraMarkerGeometry(),
    visibility = createScalarMotion();
  scene.add(root);
  function pose(record, camera) {
    const key = JSON.stringify(camera.view);
    if (record.pose === key) return;
    record.pose = key;
    const target = worldVector(camera.view.target),
      position = worldVector(camera.view.position);
    if (camera.virtual)
      position
        .copy(target)
        .add(
          worldVector(camera.view.position)
            .sub(target)
            .normalize()
            .multiplyScalar(4),
        );
    record.body.position.copy(position);
    record.body.lookAt(target);
    record.focus.position.copy(target);
    const corners = cameraFrame(camera.view),
      points = [];
    for (const corner of corners) points.push(position, corner);
    for (const [a, b] of [
      [0, 1],
      [1, 3],
      [3, 2],
      [2, 0],
    ])
      points.push(corners[a], corners[b]);
    const buffer = record.frame.geometry.attributes.position;
    points.forEach((point, i) => buffer.setXYZ(i, point.x, point.y, point.z));
    buffer.needsUpdate = true;
    record.frame.geometry.computeBoundingSphere();
  }
  function style(record, camera, options) {
    const selected = options.selectedCamera === camera.id;
    const hover =
      options.hoveredCamera === camera.id ? options.hoveredCameraPart : "";
    const active = selected ? options.draggingCameraPart : "";
    const base = camera.virtual ? 0x43d3db : selected ? 0xa78bfa : 0xf6b451;
    for (const [material, part] of [
      [record.bodyMaterial, "body"],
      [record.focusMaterial, "target"],
    ]) {
      const colour =
        active === part ? 0xc4b5fd : hover === part ? 0xffffff : base;
      material.userData.targetColour = new Color(colour);
      if (!record.styled || reducedMapMotion())
        material.color.copy(material.userData.targetColour);
    }
    record.halo.visible = selected || hover === "target" || active === "target";
    record.haloMaterial.color.set(
      active === "target" ? 0xffffff : hover === "target" ? 0xa78bfa : 0x17131f,
    );
    record.frame.material.color.set(base);
    record.frame.material.userData.cameraOpacity =
      selected || camera.virtual ? 0.85 : 0.35;
    record.styled = true;
  }
  function applyVisibility() {
    const opacity = visibility.value("cameras", 0);
    root.visible = opacity > 0;
    root.traverse((node) => {
      if (!node.material) return;
      node.material.transparent = true;
      node.material.opacity =
        (node.material.userData.cameraOpacity ?? 1) * opacity;
    });
  }
  return {
    root,
    update(document, options) {
      const visible =
        !!options.editCameras &&
        options.master !== false &&
        document.kind === "tiles";
      visibility.set("cameras", +visible, {
        duration: 220,
        immediate:
          reducedMapMotion() ||
          options.master === false ||
          document.kind !== "tiles",
      });
      const values = (document.cameras || []).map((camera) =>
        options.previewCamera?.id === camera.id
          ? options.previewCamera
          : camera,
      );
      if (options.broadcastView)
        values.push({
          id: "virtual-camera",
          view: options.broadcastView,
          virtual: true,
        });
      const keep = new Set();
      for (const camera of values) {
        keep.add(camera.id);
        let record = records.get(camera.id);
        if (!record) {
          record = geometry.create(camera.id, camera.virtual);
          records.set(camera.id, record);
          root.add(record.root);
        }
        pose(record, camera);
        style(record, camera, options);
      }
      for (const [id, record] of records)
        if (!keep.has(id)) {
          record.dispose();
          records.delete(id);
        }
      applyVisibility();
      root.updateMatrixWorld(true);
    },
    advance(delta) {
      let moving = visibility.isMoving();
      visibility.advance(delta, reducedMapMotion());
      applyVisibility();
      if (!root.visible) return moving;
      const blend = reducedMapMotion() ? 1 : 1 - Math.exp(-delta / 40);
      for (const record of records.values())
        for (const material of [record.bodyMaterial, record.focusMaterial]) {
          const target = material.userData.targetColour,
            colour = material.color;
          if (
            Math.max(
              Math.abs(colour.r - target.r),
              Math.abs(colour.g - target.g),
              Math.abs(colour.b - target.b),
            ) < 0.001
          )
            colour.copy(target);
          else {
            colour.lerp(target, blend);
            moving = true;
          }
        }
      return moving;
    },
    pick(ray) {
      if (!root.visible || !visibility.target("cameras")) return null;
      for (const hit of ray.intersectObject(root, true)) {
        let node = hit.object;
        while (node) {
          if (node.userData.cameraId)
            return {
              cameraId: node.userData.cameraId,
              cameraPart: node.userData.cameraPart,
              distance: hit.distance,
              point: { x: hit.point.x, y: hit.point.z, elevation: hit.point.y },
            };
          node = node.parent;
        }
      }
      return null;
    },
    destroy() {
      for (const record of records.values()) record.dispose();
      records.clear();
      geometry.dispose();
      root.removeFromParent();
    },
  };
}
