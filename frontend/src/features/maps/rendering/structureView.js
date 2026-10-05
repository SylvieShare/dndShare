import { Plane, Vector3 } from "three";
import { FLOOR } from "./annotations";
import { structureContext, structureCellKey } from "../lib/tileStructure";
import { tileSize } from "../lib/tilePlacement";

export function structureView(assets, cameraView) {
  let context = structureContext({ width: 2, height: 2, tiles: [] }, []),
    document;
  function update(d) {
    document = d;
    context = structureContext(d, assets.catalogue());
    if (!context.status.valid) throw new Error(context.status.message);
    return d.tiles.map((tile) => ({
      ...tile,
      elevation: context.placements.get(tile.id)?.elevation || 0,
    }));
  }
  function posed(tile) {
    return {
      ...tile,
      elevation:
        context.placements.get(tile.id)?.elevation || tile.elevation || 0,
    };
  }
  function preview(group) {
    const ids = new Set(group.map((t) => t.id).filter(Boolean));
    const map = {
      ...document,
      tiles: [...document.tiles.filter((t) => !ids.has(t.id)), ...group],
    };
    const next = structureContext(map, assets.catalogue());
    return group.map((tile) => ({
      ...tile,
      elevation:
        next.placements.get(tile.id)?.elevation ||
        context.placements.get(tile.id)?.elevation ||
        0,
    }));
  }
  function point(event, modelId, previewTile) {
    if (!modelId) return cameraView.world(event);
    const ray = cameraView.ray(event),
      planes = new Map(),
      ignored = new Set(previewTile?.tileIds || []),
      offset = previewTile?.grabOffset || { x: 0, y: 0 },
      levelOffset = previewTile?.levelOffset || 0,
      support = previewTile?.supportBounds,
      size = tileSize(
        { rotation: previewTile?.rotation || 0 },
        assets.metadata(modelId),
      );
    for (const [key, slot] of context.sockets) {
      const level = Number(key.split(",")[2]);
      if (level + levelOffset < 16 && !ignored.has(slot.parent))
        planes.set(`${level}:${slot.elevation}`, {
          level,
          elevation: slot.elevation,
        });
    }
    const intersections = [];
    for (const { level, elevation } of planes.values()) {
      const hit = ray.ray.intersectPlane(
        new Plane(
          new Vector3(0, 1, 0),
          -elevation - (previewTile?.grabHeight || 0),
        ),
        new Vector3(),
      );
      if (!hit) continue;
      const x = Math.round(hit.x - offset.x - size.width / 2),
        y = Math.round(hit.z - offset.y - size.height / 2);
      let supported = false;
      const sx = x + (support?.x || 0),
        sy = y + (support?.y || 0);
      for (let cy = sy; cy < sy + (support?.height || size.height); cy++)
        for (let cx = sx; cx < sx + (support?.width || size.width); cx++) {
          const slot = context.sockets.get(structureCellKey(cx, cy, level));
          supported ||=
            !!slot &&
            !ignored.has(slot.parent) &&
            Math.abs(slot.elevation - elevation) < 0.015;
        }
      if (supported)
        intersections.push({
          x: hit.x,
          y: hit.z,
          level: level + levelOffset,
          elevation,
          distance: ray.ray.origin.distanceTo(hit),
        });
    }
    intersections.sort((a, b) => a.distance - b.distance);
    const ground = {
      ...cameraView.world(event, previewTile?.grabHeight ?? FLOOR),
      level: levelOffset,
    };
    return {
      ...(intersections[0] || ground),
      candidates: [...intersections, ground],
    };
  }
  function top() {
    let height = 1;
    for (const tile of document?.tiles || [])
      height = Math.max(
        height,
        posed(tile).elevation + (assets.metadata(tile.modelId)?.maxHeight || 0),
      );
    return height;
  }
  return { update, posed, preview, point, top, context: () => context };
}
