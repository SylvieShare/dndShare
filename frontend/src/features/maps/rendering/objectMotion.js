import { Vector3 } from "three";
import { createRotationMotion } from "./rotationMotion";
export function createObjectMotion(assets, tileMatrix) {
  const motion = createRotationMotion(),
    point = new Vector3();
  let objects = new Map(),
    parents = new Map();
  return {
    update(items, document) {
      objects = new Map(items.map((o) => [o.id, o]));
      parents = new Map(document.tiles.map((t) => [t.id, t]));
      motion.retain(new Set(objects.keys()));
      for (const object of items) motion.set(object.id, object);
    },
    advance(delta, root) {
      const moving = motion.advance(delta);
      for (const child of root.children) {
        const object = objects.get(
          child.userData.objectId || child.userData.tokenId,
        );
        if (!object) continue;
        const pose = motion.pose(object.id);
        child.position.set(pose.x, pose.elevation, pose.y);
        child.rotation.y = (-pose.rotation * Math.PI) / 180;
        const parent = parents.get(object.placement?.tileId),
          model = assets.metadata(parent?.modelId);
        const anchor = model?.placementPoints?.[object.placement?.point],
          matrix = parent && tileMatrix(parent.id);
        if (anchor && matrix) {
          child.rotation.y +=
            Math.atan2(matrix.elements[8], matrix.elements[0]) +
            (parent.rotation * Math.PI) / 180;
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
      }
      root.updateMatrixWorld(true);
      return moving;
    },
    destroy: motion.clear,
  };
}
