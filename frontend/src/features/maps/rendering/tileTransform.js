import { Box3, Matrix4 } from "three";
import { tileSize } from "../lib/tilePlacement";
const localBounds = new WeakMap();
export function tileTransform(tile, model) {
  return tilePoseTransform(tilePose(tile, model), model);
}
export function tilePose(tile, model) {
  const { width, height } = tileSize(tile, model);
  return {
    x: tile.x + width / 2,
    y: tile.y + height / 2,
    elevation: tile.elevation || 0,
    rotation: tile.rotation,
    mirrored: !!tile.mirrored,
  };
}
export function tilePoseTransform(pose, model) {
  const [offsetX, offsetZ] = model.placementOffset || [0, 0];
  const matrix = new Matrix4().makeRotationY((-pose.rotation * Math.PI) / 180);
  const values = matrix.elements,
    sign = pose.mirrored ? -1 : 1;
  // Local reflection flips column X; the animation squeezes world row X.
  values[0] *= sign * (pose.mirrorScale ?? 1);
  values[2] *= sign;
  values[8] *= pose.mirrorScale ?? 1;
  values[12] = pose.x + values[0] * offsetX + values[8] * offsetZ;
  values[13] = (pose.elevation || 0) - (model.mountDepth || 0);
  values[14] = pose.y + values[2] * offsetX + values[10] * offsetZ;
  matrix.mirroring = !!pose.mirroring;
  return matrix;
}
export function tileBounds(tile, metadata, model, transform) {
  let bounds = localBounds.get(model);
  if (!bounds) {
    bounds = new Box3();
    for (const part of model.parts) {
      if (!part.geometry.boundingBox) part.geometry.computeBoundingBox();
      bounds.union(part.geometry.boundingBox.clone().applyMatrix4(part.matrix));
    }
    localBounds.set(model, bounds);
  }
  return bounds
    .clone()
    .applyMatrix4(transform || tileTransform(tile, metadata));
}
