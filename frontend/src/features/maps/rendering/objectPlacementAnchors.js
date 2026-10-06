import { Group, Mesh, MeshBasicMaterial, SphereGeometry } from "three";
import { surfacePoints } from "../lib/surfacePlacement";
export function objectPlacementAnchors() {
  const root = new Group(),
    geometry = new SphereGeometry(0.065, 12, 8);
  const on = new MeshBasicMaterial({ color: 0xb399e5 }),
    off = new MeshBasicMaterial({ color: 0x73c99a });
  let key = "",
    points = [];
  return {
    root,
    update(document, catalogue, object, show) {
      root.visible = !!show;
      if (!show) return;
      points = surfacePoints(
        document,
        catalogue,
        object?.moving ? object.id : "",
      );
      const next = JSON.stringify([points, object?.placement]);
      if (key === next) return;
      key = next;
      root.clear();
      for (const point of points) {
        const selected =
          point.placement.tileId === object?.placement?.tileId &&
          point.placement.point === object?.placement?.point;
        const mesh = new Mesh(geometry, selected ? on : off);
        mesh.position.set(point.x, point.elevation + 0.035, point.y);
        mesh.userData.objectAnchor = point;
        root.add(mesh);
      }
      root.updateMatrixWorld(true);
    },
    hit(ray) {
      if (!root.visible) return null;
      const hit = ray.intersectObjects(root.children, false)[0];
      return hit
        ? {
            objectAnchor: hit.object.userData.objectAnchor,
            distance: hit.distance,
          }
        : null;
    },
    destroy() {
      root.clear();
      geometry.dispose();
      on.dispose();
      off.dispose();
    },
  };
}
