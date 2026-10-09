import { Group, InstancedMesh, Matrix4 } from "three";
import { tilePose, tilePoseTransform } from "./tileTransform";
import { createRotationMotion } from "./rotationMotion";
import { applyAreaOpacity } from "./areaOpacity";

export function createTileLayer(assets, fog) {
  const root = new Group(),
    temp = new Matrix4();
  const motion = createRotationMotion();
  const transform = (id) => {
    const pose = motion.pose(id),
      metadata = assets.metadata(allTiles.get(id)?.modelId);
    return pose && metadata ? tilePoseTransform(pose, metadata) : null;
  };
  let allTiles = new Map();
  function apply() {
    for (const mesh of root.children) {
      mesh.userData.tiles.forEach((tile, i) =>
        mesh.setMatrixAt(
          i,
          temp.multiplyMatrices(transform(tile.id), mesh.userData.partMatrix),
        ),
      );
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
    root.updateMatrixWorld(true);
  }
  function clear() {
    root.traverse((node) => {
      if (!node.isMesh) return;
      node.dispose?.();
      for (const material of Array.isArray(node.material)
        ? node.material
        : [node.material])
        material.dispose();
    });
    root.clear();
  }
  return {
    root,
    rebuild(tiles, tier, hiddenIds, opacity = () => 1) {
      clear();
      allTiles = new Map(tiles.map((t) => [t.id, t]));
      motion.retain(new Set(allTiles.keys()));
      for (const tile of tiles) {
        const metadata = assets.metadata(tile.modelId);
        if (metadata) motion.set(tile.id, tilePose(tile, metadata));
      }
      const hidden = new Set(
        Array.isArray(hiddenIds) ? hiddenIds : hiddenIds ? [hiddenIds] : [],
      );
      const buckets = new Map();
      for (const tile of tiles) {
        if (hidden.has(tile.id)) continue;
        const key = `${tile.modelId}:${Math.floor(tile.x / 12)},${Math.floor(tile.y / 12)}:${opacity(tile.id)}`;
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push(tile);
      }
      for (const items of buckets.values()) {
        const metadata = assets.metadata(items[0].modelId),
          model =
            assets.visual?.(items[0].modelId, tier) ||
            assets.model(items[0].modelId, tier);
        if (!metadata || !model) continue;
        for (const part of model.parts) {
          const materials = (
            Array.isArray(part.material) ? part.material : [part.material]
          ).map((m) => fog.material(m.clone()));
          const mesh = new InstancedMesh(
            part.geometry,
            Array.isArray(part.material) ? materials : materials[0],
            items.length,
          );
          mesh.userData.tiles = items;
          mesh.receiveShadow = true;
          mesh.userData.partMatrix = part.matrix;
          applyAreaOpacity(mesh, opacity(items[0].id));
          items.forEach((tile, i) =>
            mesh.setMatrixAt(
              i,
              temp.multiplyMatrices(transform(tile.id), part.matrix),
            ),
          );
          mesh.instanceMatrix.needsUpdate = true;
          mesh.computeBoundingSphere();
          root.add(mesh);
        }
      }
      root.updateMatrixWorld(true);
    },
    transform,
    advance(delta) {
      if (!motion.isMoving()) return false;
      const moving = motion.advance(delta);
      apply();
      return moving;
    },
    hit(ray) {
      const hit = ray.intersectObjects(root.children, false)[0];
      return hit
        ? {
            tileId: hit.object.userData.tiles[hit.instanceId].id,
            distance: hit.distance,
            point: { x: hit.point.x, y: hit.point.z, elevation: hit.point.y },
          }
        : null;
    },
    destroy: clear,
  };
}
