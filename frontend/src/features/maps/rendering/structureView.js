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
  function point(event, level = 0, modelId) {
    if (!level) return cameraView.world(event);
    const ray = cameraView.ray(event),
      heights = new Set();
    for (const [key, slot] of context.sockets)
      if (Number(key.split(",")[2]) === level) heights.add(slot.elevation);
    const surface = assets.metadata(modelId)?.surfaceHeight || FLOOR;
    const intersections = [];
    for (const elevation of heights) {
      const hit = ray.ray.intersectPlane(
        new Plane(new Vector3(0, 1, 0), -elevation - surface),
        new Vector3(),
      );
      if (!hit) continue;
      const slot = context.sockets.get(
        structureCellKey(Math.floor(hit.x), Math.floor(hit.z), level),
      );
      if (slot && Math.abs(slot.elevation - elevation) < 0.015)
        intersections.push({
          x: hit.x,
          y: hit.z,
          elevation: elevation + surface,
          distance: ray.ray.origin.distanceTo(hit),
        });
    }
    intersections.sort((a, b) => a.distance - b.distance);
    return (
      intersections[0] || {
        ...cameraView.world(event, FLOOR + level * 0.72),
        unsupported: true,
      }
    );
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
