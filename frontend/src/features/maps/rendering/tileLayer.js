import { Group, InstancedMesh, Matrix4 } from "three";
import { tileTransform } from "./tileTransform";

export function createTileLayer(assets, fog) {
  const root = new Group(),
    temp = new Matrix4();
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
    rebuild(tiles, tier, hiddenIds) {
      clear();
      const hidden = new Set(
        Array.isArray(hiddenIds) ? hiddenIds : hiddenIds ? [hiddenIds] : [],
      );
      const buckets = new Map();
      for (const tile of tiles) {
        if (hidden.has(tile.id)) continue;
        const key = `${tile.modelId}:${Math.floor(tile.x / 12)},${Math.floor(tile.y / 12)}`;
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push(tile);
      }
      for (const items of buckets.values()) {
        const metadata = assets.metadata(items[0].modelId),
          model = assets.model(items[0].modelId, tier);
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
          items.forEach((tile, i) =>
            mesh.setMatrixAt(
              i,
              temp.multiplyMatrices(tileTransform(tile, metadata), part.matrix),
            ),
          );
          mesh.instanceMatrix.needsUpdate = true;
          mesh.computeBoundingSphere();
          root.add(mesh);
        }
      }
      root.updateMatrixWorld(true);
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
