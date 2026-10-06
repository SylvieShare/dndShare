import { Group } from "three";
import { buildMapProp, disposeObjects } from "./sceneObjects";
import { FLOOR } from "./annotations";
import { createRotationMotion } from "./rotationMotion";
export function createObjectPreview(fog, assets) {
  const root = new Group();
  root.userData.outlineStyle = "selected";
  root.userData.outlineType = "object";
  const rotation = createRotationMotion();
  let target = null,
    key = "",
    position = null;
  function update(object) {
    target = object;
    root.visible = !!object;
    if (!object) {
      disposeObjects(root);
      root.clear();
      key = "";
      position = null;
      rotation.clear();
      return;
    }
    const group = object.group || [object],
      next = JSON.stringify(
        group.map((o) => [o.id, o.kind, o.modelId, o.scale, o.open]),
      );
    if (next !== key) {
      disposeObjects(root);
      root.clear();
      key = next;
      for (const o of group)
        root.add(buildMapProp(o, o.open, fog, assets, "render"));
      root.traverse((n) => {
        if (n.isMesh) {
          for (const material of Array.isArray(n.material)
            ? n.material
            : [n.material]) {
            material.transparent = true;
            material.opacity = 0.7;
          }
        }
      });
    }
    position ||= { x: object.x, y: object.y, lift: 0 };
  }
  function advance(delta) {
    if (!target || !position) return false;
    const amount = 1 - Math.exp(-delta / 45),
      lift = target.moving ? 0.22 : 0;
    position.x += (target.x - position.x) * amount;
    position.y += (target.y - position.y) * amount;
    position.lift += (lift - position.lift) * amount;
    (target.group || [target]).forEach((o, i) =>
      rotation.set(o.id || i, {
        x: o.x + position.x - target.x,
        y: o.y + position.y - target.y,
        elevation: (o.elevation ?? FLOOR) + position.lift,
        rotation: o.rotation,
      }),
    );
    const turning = rotation.advance(delta);
    (target.group || [target]).forEach((o, i) => {
      const pose = rotation.pose(o.id || i);
      root.children[i].position.set(pose.x, pose.elevation, pose.y);
      root.children[i].rotation.y = (-pose.rotation * Math.PI) / 180;
    });
    root.updateMatrixWorld(true);
    return (
      turning ||
      Math.hypot(
        target.x - position.x,
        target.y - position.y,
        lift - position.lift,
      ) > 0.001
    );
  }
  return { root, update, advance, destroy: () => disposeObjects(root) };
}
