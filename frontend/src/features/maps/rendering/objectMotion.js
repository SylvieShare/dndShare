import { Vector3 } from "three";
import { createRotationMotion } from "./rotationMotion";
export function createObjectMotion(assets, tileMatrix) {
  const motion = createRotationMotion(),
    point = new Vector3(),
    changed = new Set();
  let objects = new Map(),
    parents = new Map(),
    dirty = true;
  return {
    get needsUpdate() {
      return dirty || motion.isMoving();
    },
    changed,
    update(items, document) {
      dirty = true;
      objects = new Map(items.map((o) => [o.id, o]));
      parents = new Map(document.tiles.map((t) => [t.id, t]));
      motion.retain(new Set(objects.keys()));
      for (const object of items)
        motion.set(object.id, { ...object, rotation: object.rotation || 0 });
    },
    advance(delta, root, parentMoving = true) {
      changed.clear();
      if (!dirty && !parentMoving && !motion.isMoving()) return false;
      dirty = false;
      const moving = motion.advance(delta);
      for (const child of root.children) {
        const object = objects.get(
          child.userData.objectId || child.userData.tokenId,
        );
        if (!object) continue;
        const oldX = child.position.x,
          oldY = child.position.y,
          oldZ = child.position.z,
          oldAngle = child.rotation.y,
          oldScale = child.scale.x;
        const pose = motion.pose(object.id);
        child.position.set(pose.x, pose.elevation, pose.y);
        child.rotation.y = (-pose.rotation * Math.PI) / 180;
        if (child.userData.tokenId)
          child.scale.x = (pose.mirrored ? -1 : 1) * (pose.mirrorScale ?? 1);
        const parent = parents.get(object.placement?.tileId),
          model = assets.metadata(parent?.modelId);
        const anchor = model?.placementPoints?.[object.placement?.point],
          matrix = parent && tileMatrix(parent.id);
        if (anchor && matrix) {
          if (!matrix.mirroring) {
            const values = matrix.elements,
              sign = matrix.determinant() < 0 ? -1 : 1;
            const angle = Math.atan2(
              values[8] / Math.hypot(values[8], values[9], values[10]),
              values[0] / (sign * Math.hypot(values[0], values[1], values[2])),
            );
            child.rotation.y += angle + (parent.rotation * Math.PI) / 180;
          }
          child.position.copy(
            point
              .set(
                anchor.x - model.width / 2 - (model.placementOffset?.[0] || 0),
                anchor.elevation,
                anchor.y - model.height / 2 - (model.placementOffset?.[1] || 0),
              )
              .applyMatrix4(matrix),
          );
          if (child.userData.tokenId) child.position.y += 0.05;
        }
        if (
          oldX !== child.position.x ||
          oldY !== child.position.y ||
          oldZ !== child.position.z ||
          oldAngle !== child.rotation.y ||
          oldScale !== child.scale.x
        ) {
          changed.add(object.id);
          child.updateMatrix();
          child.updateMatrixWorld(true);
        }
      }
      return moving;
    },
    destroy: motion.clear,
  };
}
