import { modelVisual } from "./modelVisual";
import { Vector3 } from "three";
import { surfacePoints } from "../lib/surfacePlacement";
import { tileBounds } from "./tileTransform";
import { imageTokenPoint, tokenPlacementPoints, unoccupiedObjectPoints } from "../lib/tokenPlacement";
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
  let cachedContext;
  const surfaces = new Map();
  function screenBounds(tile) {
    const model = modelVisual(assets, tile.modelId, getTier()),
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
    invalidate() {
      cachedContext = null;
      surfaces.clear();
    },
    surfacePoint(event, ignored = "", token, state) {
      const document = getDocument();
      if (!document) return null;
      if (document.kind === "image") {
        const p = view.world(event);
        if (
          p.x < 0 ||
          p.y < 0 ||
          p.x >= document.width ||
          p.y >= document.height
        )
          return null;
        if (token) return imageTokenPoint(p, token, document, state);
        return {
          x: Math.floor(p.x) + 0.5,
          y: Math.floor(p.y) + 0.5,
          elevation: 0.44,
          grid: true,
        };
      }
      const context = structure.context();
      if (context !== cachedContext) {
        surfaces.clear();
        cachedContext = context;
      }
      if (!surfaces.has(ignored)) {
        surfaces.set(
          ignored,
          surfacePoints(
            document,
            assets.catalogue(),
            ignored,
            getHiddenTiles(),
            context,
          ),
        );
        if (surfaces.size > 4) surfaces.delete(surfaces.keys().next().value);
      }
      const points = token
          ? tokenPlacementPoints(document, assets.catalogue(), token, state, surfaces.get(ignored), context)
          : unoccupiedObjectPoints(document,assets.catalogue(),state,surfaces.get(ignored),context),
        rect = host.getBoundingClientRect();
      let best = null,
        distance = Infinity;
      for (const point of points) {
        const p = view.project(new Vector3(point.x + (token?.grabOffset?.x || 0), point.elevation, point.y + (token?.grabOffset?.y || 0)));
        const next = Math.hypot(
          p.x + rect.left - event.clientX,
          p.y + rect.top - event.clientY,
        );
        if (next < distance - .01 || Math.abs(next-distance) <= .01 && best?.invalidSurface && !point.invalidSurface) {
          distance = next;
          best = point;
        }
      }
      return !token || token.kind === "marker" || distance <= Math.max(12,(view.getView?.().cellPixels || 48)*.75) ? best : null;
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
