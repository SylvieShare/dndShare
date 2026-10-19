export function visibleSceneHits(ray, roots, appearance) {
  return roots
    .flatMap((root) => ray.intersectObject(root, true))
    .filter((hit) => {
      let node = hit.object;
      const object = node.userData.objects?.[hit.instanceId];
      if (object) {
        if (appearance.hiddenObjects.has(object.id)) return false;
        hit.mapObjectId = object.id;
      }
      const tile = node.userData.tiles?.[hit.instanceId];
      if (tile && appearance.hiddenTiles.has(tile.id)) return false;
      while (node) {
        if (
          !node.visible ||
          (node.userData.objectId &&
            appearance.hiddenObjects.has(node.userData.objectId))
        )
          return false;
        if (
          node.userData.tokenId &&
          (appearance.hiddenTiles.has(node.userData.placementTileId) ||
            appearance.foggedTiles.has(node.userData.placementTileId))
        )
          return false;
        node = node.parent;
      }
      return true;
    })
    .sort((a, b) => a.distance - b.distance);
}
// Resolve editor hits in visible depth order, including loading placeholders.
export function pickMapScene(
  event,
  {
    view,
    tiles,
    loadingPreview,
    preview,
    lighting,
    effects,
    surfaceAnchors,
    anchors,
    objects,
    appearance = {
      hiddenTiles: new Set(),
      hiddenObjects: new Set(),
      foggedTiles: new Set(),
    },
  },
) {
  const ray = view.ray(event),
    hits = visibleSceneHits(ray, [objects], appearance),
    fixed = tiles.hit(ray, appearance.hiddenTiles),
    pending = loadingPreview.hit(ray, (kind, id) =>
      (kind === "tile" ? appearance.hiddenTiles : appearance.hiddenObjects).has(
        id,
      ),
    ),
    moving = preview.hit(ray),
    resolvedTile =
      moving && (!fixed || moving.distance < fixed.distance) ? moving : fixed;
  const tile =
    pending?.tileId &&
    (!resolvedTile || pending.distance < resolvedTile.distance)
      ? pending
      : resolvedTile;
  if (
    pending?.objectId &&
    (!tile || pending.distance < tile.distance) &&
    (!hits[0] || pending.distance < hits[0].distance)
  )
    return pending;
  const lamp = lighting.pick(ray);
  if (lamp) return lamp;
  const effect = effects?.pick(ray);
  if (
    effect &&
    (!tile || effect.distance < tile.distance) &&
    (!hits[0] || effect.distance < hits[0].distance)
  )
    return effect;
  const surfaceAnchor = surfaceAnchors.hit(ray);
  if (surfaceAnchor) return surfaceAnchor;
  const anchor = anchors.hit(ray);
  if (
    anchor &&
    (!tile || anchor.distance < tile.distance) &&
    (!hits[0] || anchor.distance < hits[0].distance)
  )
    return anchor;
  for (const hit of hits) {
    if (tile && tile.distance < hit.distance) return tile;
    if (hit.mapObjectId) return { objectId: hit.mapObjectId };
    let node = hit.object;
    while (node) {
      if (node.userData.objectId) return { objectId: node.userData.objectId };
      if (node.userData.tokenId) return { tokenId: node.userData.tokenId };
      node = node.parent;
    }
  }
  return tile;
}
