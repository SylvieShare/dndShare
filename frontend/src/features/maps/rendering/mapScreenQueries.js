import { Vector3 } from "three";
import { surfacePoints } from "../lib/surfacePlacement";
import { tileBounds } from "./tileTransform";
export function mapScreenQueries(
  host,
  view,
  assets,
  preview,
  tiles,
  structure,
  getDocument,
  getTier,
  getHiddenTiles = () => new Set(),
) {
  function screenBounds(tile) {
    const model = assets.model(tile.modelId, getTier()),
      metadata = assets.metadata(tile.modelId);
    if (!model || !metadata) return null;
    const landing = preview.posed(tile.id);
    const bounds = tileBounds(
        landing || structure.posed(tile),
        metadata,
        model,
        landing ? null : tiles.transform(tile.id),
      ),
      points = [];
    for (const x of [bounds.min.x, bounds.max.x])
      for (const y of [bounds.min.y, bounds.max.y])
        for (const z of [bounds.min.z, bounds.max.z])
          points.push(view.project(new Vector3(x, y, z)));
    return {
      left: Math.min(...points.map((p) => p.x)),
      right: Math.max(...points.map((p) => p.x)),
      top: Math.min(...points.map((p) => p.y)),
      bottom: Math.max(...points.map((p) => p.y)),
    };
  }
  return {
    surfacePoint(event, ignored = "") {
      const document = getDocument();
      if (!document) return null;
      const points = surfacePoints(
          document,
          assets.catalogue(),
          ignored,
          getHiddenTiles(),
        ),
        rect = host.getBoundingClientRect();
      let best = null,
        distance = Infinity;
      for (const point of points) {
        const p = view.project(new Vector3(point.x, point.elevation, point.y));
        const next = Math.hypot(
          p.x + rect.left - event.clientX,
          p.y + rect.top - event.clientY,
        );
        if (next < distance) {
          distance = next;
          best = point;
        }
      }
      return best;
    },
    tilesInRect(rect) {
      return (getDocument()?.tiles || [])
        .filter((tile) => !getHiddenTiles().has(tile.id))
        .filter((tile) => {
          const b = screenBounds(tile);
          return (
            b &&
            b.right >= rect.left &&
            b.left <= rect.left + rect.width &&
            b.bottom >= rect.top &&
            b.top <= rect.top + rect.height
          );
        })
        .map((tile) => tile.id);
    },
  };
}
