// Resolve editor hits in visible depth order, including loading placeholders.
export function pickMapScene(
  event,
  {
    view,
    tiles,
    loadingPreview,
    preview,
    lighting,
    surfaceAnchors,
    anchors,
    objects,
  },
) {
  const ray = view.ray(event),
    hits = ray.intersectObject(objects, true),
    fixed = tiles.hit(ray),
    pending = loadingPreview.hit(ray),
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
    let node = hit.object;
    while (node) {
      if (node.userData.objectId) return { objectId: node.userData.objectId };
      if (node.userData.tokenId) return { tokenId: node.userData.tokenId };
      node = node.parent;
    }
  }
  return tile;
}
