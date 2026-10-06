import { Box3, Matrix4, Quaternion, Vector3 } from "three";
import { tileSize } from "../lib/tilePlacement";
const up = new Vector3(0, 1, 0);
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
  };
}
export function tilePoseTransform(pose, model) {
  const [offsetX, offsetZ] = model.placementOffset || [0, 0];
  return new Matrix4()
    .compose(
      new Vector3(
        pose.x,
        (pose.elevation || 0) - (model.mountDepth || 0),
        pose.y,
      ),
      new Quaternion().setFromAxisAngle(up, (-pose.rotation * Math.PI) / 180),
      new Vector3(1, 1, 1),
    )
    .multiply(new Matrix4().makeTranslation(offsetX, 0, offsetZ));
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
