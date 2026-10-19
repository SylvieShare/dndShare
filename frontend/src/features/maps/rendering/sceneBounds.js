import { Box3 } from "three";

// Instance matrices can change while the mesh's world matrix stays identity.
// Always refresh instance bounds when preparing a new capture/outline region.
export function sceneBounds(root, target = new Box3()) {
  target.makeEmpty();
  root.updateMatrixWorld(true);
  root.traverseVisible((node) => {
    if (!node.isMesh) return;
    if (node.isInstancedMesh) node.computeBoundingBox();
    else if (!node.geometry.boundingBox) node.geometry.computeBoundingBox();
    const bounds = node.isInstancedMesh
      ? node.boundingBox
      : node.geometry.boundingBox;
    if (bounds) target.union(bounds.clone().applyMatrix4(node.matrixWorld));
  });
  return target;
}
