import { structureContext } from "./tileStructure";
import { hiddenAreaMembers } from "./mapAreas";

export function surfacePosition(tile, model, point, elevation = 0) {
  let x = point.x,
    y = point.y;
  if (tile.rotation === 90) [x, y] = [model.height - y, x];
  if (tile.rotation === 180) [x, y] = [model.width - x, model.height - y];
  if (tile.rotation === 270) [x, y] = [y, model.width - x];
  return {
    x: tile.x + x,
    y: tile.y + y,
    elevation: elevation + point.elevation - (model.mountDepth || 0),
  };
}
export function surfacePoints(
  document,
  catalogue,
  ignoreObject = "",
  hiddenTiles = new Set(),
) {
  const context = structureContext(document, catalogue);
  const occupied = new Set(
    document.objects
      .filter((o) => o.id !== ignoreObject && o.placement)
      .map((o) => `${o.placement.tileId}:${o.placement.point}`),
  );
  return document.tiles.flatMap((tile) => {
    if (hiddenTiles.has(tile.id)) return [];
    const model = context.models.get(tile.modelId);
    if (!model?.canStand) return [];
    return (model.placementPoints || []).flatMap((point, index) =>
      occupied.has(`${tile.id}:${index}`)
        ? []
        : [
            {
              ...surfacePosition(
                tile,
                model,
                point,
                context.placements.get(tile.id)?.elevation || 0,
              ),
              placement: { tileId: tile.id, point: index },
              level: tile.level,
            },
          ],
    );
  });
}
export function resolvedSurfacePosition(entity, document, catalogue, context) {
  if (!entity.placement)
    return { ...entity, elevation: entity.elevation ?? 0.44 };
  const tile = document.tiles.find((t) => t.id === entity.placement.tileId),
    models = new Map(catalogue.map((m) => [m.id, m]));
  const model = models.get(tile?.modelId),
    point = model?.placementPoints?.[entity.placement.point];
  if (!tile || !point)
    return { ...entity, elevation: entity.elevation ?? 0.44 };
  const poses = context || structureContext(document, catalogue);
  return {
    ...entity,
    ...surfacePosition(
      tile,
      model,
      point,
      poses.placements.get(tile.id)?.elevation || 0,
    ),
  };
}
export function nearestSurface(point, document, catalogue, ignoreObject = "") {
  const candidates = surfacePoints(
    document,
    catalogue,
    ignoreObject,
    hiddenAreaMembers(document).tiles,
  );
  candidates.sort(
    (a, b) =>
      Math.hypot(a.x - point.x, a.y - point.y) -
        Math.hypot(b.x - point.x, b.y - point.y) || b.elevation - a.elevation,
  );
  return candidates[0] || null;
}
export function syncSurfaceObjects(document, catalogue) {
  document.objects = document.objects.filter(
    (o) =>
      !o.placement || document.tiles.some((t) => t.id === o.placement.tileId),
  );
  const context = structureContext(document, catalogue);
  for (const object of document.objects)
    if (object.placement) {
      const pose = resolvedSurfacePosition(
        object,
        document,
        catalogue,
        context,
      );
      object.x = pose.x;
      object.y = pose.y;
    }
}
