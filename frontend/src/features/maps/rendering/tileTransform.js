import { Box3, Matrix4, Quaternion, Vector3 } from "three";
import { tileSize } from "../lib/tilePlacement";
const up = new Vector3(0, 1, 0);
const localBounds = new WeakMap();
export function tileTransform(tile, model) {
  const { width, height } = tileSize(tile, model);
  return new Matrix4().compose(
    new Vector3(
      tile.x + width / 2,
      (tile.elevation || 0) - (model.mountDepth || 0),
      tile.y + height / 2,
    ),
    new Quaternion().setFromAxisAngle(up, (-tile.rotation * Math.PI) / 180),
    new Vector3(1, 1, 1),
  );
}
export function tileBounds(tile, metadata, model) {
  let bounds = localBounds.get(model);
  if (!bounds) {
    bounds = new Box3();
    for (const part of model.parts) {
      if (!part.geometry.boundingBox) part.geometry.computeBoundingBox();
      bounds.union(part.geometry.boundingBox.clone().applyMatrix4(part.matrix));
    }
    localBounds.set(model, bounds);
  }
  return bounds.clone().applyMatrix4(tileTransform(tile, metadata));
}
