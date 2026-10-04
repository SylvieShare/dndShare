import {
  BoxGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Quaternion,
  Vector3,
} from "three";

const up = new Vector3(0, 1, 0);
function placement(tile, model) {
  const swapped = tile.rotation % 180 !== 0,
    w = swapped ? model.height : model.width,
    h = swapped ? model.width : model.height;
  return new Matrix4().compose(
    new Vector3(tile.x + w / 2, tile.level * 2, tile.y + h / 2),
    new Quaternion().setFromAxisAngle(up, (-tile.rotation * Math.PI) / 180),
    new Vector3(1, 1, 1),
  );
}
export function createTileLayer(assets, fog) {
  const root = new Group(),
    picks = [];
  const pickGeometry = new BoxGeometry(1, 1, 1),
    pickMaterial = new MeshBasicMaterial();
  const temp = new Matrix4(),
    matrix = new Matrix4(),
    quaternion = new Quaternion(),
    vector = new Vector3();
  function clear() {
    root.traverse((node) => {
      if (node.isMesh) {
        node.dispose?.();
        for (const m of Array.isArray(node.material)
          ? node.material
          : [node.material])
          m.dispose();
      }
    });
    root.clear();
    picks.forEach((p) => p.dispose());
    picks.length = 0;
  }
  return {
    root,
    rebuild(tiles, tier, preview) {
      clear();
      const buckets = new Map();
      for (const tile of tiles) {
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
          items.forEach((tile, i) =>
            mesh.setMatrixAt(
              i,
              temp.multiplyMatrices(placement(tile, metadata), part.matrix),
            ),
          );
          mesh.instanceMatrix.needsUpdate = true;
          mesh.computeBoundingSphere();
          root.add(mesh);
        }
        const proxy = new InstancedMesh(
          pickGeometry,
          pickMaterial,
          items.length,
        );
        proxy.userData.tiles = items;
        items.forEach((tile, i) => {
          const swap = tile.rotation % 180 !== 0,
            w = swap ? metadata.height : metadata.width,
            h = swap ? metadata.width : metadata.height;
          vector.set(w, metadata.maxHeight, h);
          quaternion.identity();
          matrix.compose(
            new Vector3(
              tile.x + w / 2,
              tile.level * 2 + metadata.maxHeight / 2,
              tile.y + h / 2,
            ),
            quaternion,
            vector,
          );
          proxy.setMatrixAt(i, matrix);
        });
        proxy.computeBoundingSphere();
        proxy.updateMatrixWorld(true);
        picks.push(proxy);
      }
      if (preview) {
        const metadata = assets.metadata(preview.modelId),
          model = assets.model(preview.modelId, tier);
        if (metadata && model)
          for (const part of model.parts) {
            const materials = (
              Array.isArray(part.material) ? part.material : [part.material]
            ).map((m) => {
              const result = m.clone();
              result.transparent = true;
              result.opacity = 0.45;
              result.depthWrite = false;
              return result;
            });
            const mesh = new Mesh(
              part.geometry,
              Array.isArray(part.material) ? materials : materials[0],
            );
            mesh.matrixAutoUpdate = false;
            mesh.matrix.multiplyMatrices(
              placement(preview, metadata),
              part.matrix,
            );
            root.add(mesh);
          }
      }
    },
    hit(ray) {
      const hit = ray.intersectObjects(picks, false)[0];
      return hit
        ? { tileId: hit.object.userData.tiles[hit.instanceId].id }
        : null;
    },
    destroy() {
      clear();
      pickGeometry.dispose();
      pickMaterial.dispose();
    },
  };
}
