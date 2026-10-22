import { Group } from "three";
import { createModelBatches } from "./modelBatches";
import { tilePose, tilePoseTransform } from "./tileTransform";
import { createRotationMotion } from "./rotationMotion";

export function createTileLayer(assets, fog) {
  const root = new Group();
  root.matrixAutoUpdate = false;
  const batches = createModelBatches(root, assets, fog, "tiles");
  const motion = createRotationMotion();
  const transforms = new Map();
  const transform = (id) => {
    if (transforms.has(id)) return transforms.get(id);
    const pose = motion.pose(id),
      metadata = assets.metadata(allTiles.get(id)?.modelId);
    if (!pose || !metadata) return null;
    const matrix = tilePoseTransform(pose, metadata);
    transforms.set(id, matrix);
    return matrix;
  };
  let allTiles = new Map(),
    refresh;
  return {
    root,
    rebuild(
      tiles,
      tier,
      hiddenIds,
      opacity = () => 1,
      group = (id) => opacity(id),
    ) {
      allTiles = new Map(tiles.map((t) => [t.id, t]));
      transforms.clear();
      motion.retain(new Set(allTiles.keys()));
      for (const tile of tiles) {
        const metadata = assets.metadata(tile.modelId);
        if (metadata) motion.set(tile.id, tilePose(tile, metadata));
      }
      const hidden = new Set(
        Array.isArray(hiddenIds) ? hiddenIds : hiddenIds ? [hiddenIds] : [],
      );
      refresh = () => {
        const buckets = new Map();
        for (const tile of tiles) {
          if (hidden.has(tile.id)) continue;
          const key = `${tile.modelId}:${!!motion.pose(tile.id)?.mirrored}:${Math.floor(tile.x / 12)},${Math.floor(tile.y / 12)}:${group(tile.id)}`;
          if (!buckets.has(key)) buckets.set(key, []);
          buckets.get(key).push(tile);
        }
        batches.sync(
          new Map(
            [...buckets].map(([key, items]) => [
              key,
              {
                modelId: items[0].modelId,
                tier,
                reflected: !!motion.pose(items[0].id)?.mirrored,
                items,
                pose: (tile) => transform(tile.id),
                opacity: opacity(items[0].id),
              },
            ]),
          ),
        );
      };
      refresh();
      root.updateMatrixWorld(true);
    },
    transform,
    applyAppearance(appearance) {
      batches.applyAppearance(appearance.tileOpacity, appearance.tileFlash);
    },
    advance(delta) {
      if (!motion.isMoving()) return false;
      const moving = motion.advance(delta);
      for (const id of motion.changed) transforms.delete(id);
      if (motion.flipped.size) refresh();
      batches.advance(motion.changed);
      root.updateMatrixWorld(true);
      return moving;
    },
    hit(ray, hidden = new Set()) {
      const hit = ray
        .intersectObjects(
          root.children.filter((n) => n.visible),
          false,
        )
        .find((h) => !hidden.has(h.object.userData.tiles[h.instanceId].id));
      return hit
        ? {
            tileId: hit.object.userData.tiles[hit.instanceId].id,
            distance: hit.distance,
            point: { x: hit.point.x, y: hit.point.z, elevation: hit.point.y },
          }
        : null;
    },
    destroy() {
      batches.destroy();
      motion.clear();
      allTiles.clear();
      transforms.clear();
    },
  };
}
