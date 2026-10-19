import { Box3, Frustum, Matrix4, Vector3 } from "three";
import { tileSize } from "../lib/tilePlacementSize";

const low = new Vector3(),
  high = new Vector3();
export function createAssetView(camera, assets) {
  const chunks = new Map(),
    frustum = new Frustum(),
    matrix = new Matrix4();
  const tilesById = new Map(),
    objectsById = new Map();
  return {
    update(tiles, objects) {
      chunks.clear();
      tilesById.clear();
      objectsById.clear();
      for (const [items, kind, index] of [
        [tiles, "tile", tilesById],
        [objects, "object", objectsById],
      ])
        for (const item of items) {
          index.set(item.id, item);
          const model =
            assets.metadata(item.modelId) ||
            (kind === "object" ? { width: 1, height: 1, maxHeight: 2 } : null);
          if (!model) continue;
          const key = `${Math.floor(item.x / 12)},${Math.floor(item.y / 12)}`;
          if (!chunks.has(key))
            chunks.set(key, {
              bounds: new Box3(),
              tiles: new Set(),
              objects: new Set(),
              models: new Set(),
            });
          const chunk = chunks.get(key),
            scale = item.scale || 1;
          const size = tileSize(item, model);
          const radius =
            kind === "tile" ? 0 : Math.hypot(model.width, model.height) * scale;
          const offset = Math.max(
            ...(model.placementOffset || [0, 0]).map(Math.abs),
          );
          const pad = 1 + radius + offset;
          low.set(item.x - pad, (item.elevation || 0) - 1, item.y - pad);
          high.set(
            item.x + size.width + pad,
            (item.elevation || 0) + (model.maxHeight || 1) * scale + 1,
            item.y + size.height + pad,
          );
          chunk.bounds.expandByPoint(low).expandByPoint(high);
          chunk[kind === "tile" ? "tiles" : "objects"].add(item.id);
          if (item.modelId) chunk.models.add(item.modelId);
        }
    },
    read(options = {}) {
      // A prefetch halo keeps newly revealed edges ready during orbit/pan.
      matrix.copy(camera.projectionMatrix);
      matrix.elements[0] *= 0.75;
      matrix.elements[5] *= 0.75;
      frustum.setFromProjectionMatrix(
        matrix.multiply(camera.matrixWorldInverse),
      );
      const tiles = new Set(),
        objects = new Set(),
        models = new Set(),
        keys = [];
      for (const [key, chunk] of chunks) {
        if (!options.capture && !frustum.intersectsBox(chunk.bounds)) continue;
        keys.push(key);
        for (const id of chunk.tiles) tiles.add(id);
        for (const id of chunk.objects) objects.add(id);
        for (const id of chunk.models) models.add(id);
      }
      for (const [ids, index] of [
        [options.selectedTiles || [options.selectedTile], tilesById],
        [options.selectedObjects || [options.selectedObject], objectsById],
      ])
        for (const id of ids)
          if (index.get(id)?.modelId) models.add(index.get(id).modelId);
      return { tiles, objects, models, key: keys.join(";") };
    },
  };
}
