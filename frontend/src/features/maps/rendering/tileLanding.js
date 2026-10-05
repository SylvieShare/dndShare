const poseKey = (tile) =>
  [tile.modelId, tile.x, tile.y, tile.level, tile.rotation].join(":");

// A committed catalogue tile receives a UUID only on drop. Existing UUIDs also
// let cancellation animate back to the unchanged document rather than teleport.
export function landingTarget(preview, placed) {
  const original = preview.group || [preview];
  const ids = new Map(placed.map((t) => [t.id, t]));
  const positions = new Map(placed.map((t) => [poseKey(t), t]));
  const group = original.map((t) =>
    t.id ? ids.get(t.id) : positions.get(poseKey(t)),
  );
  if (group.some((t) => !t)) return { target: preview, hidden: [], fade: true };
  const index = Math.max(
    0,
    original.findIndex((t) => t.id === (preview.tileId || preview.id)),
  );
  return {
    target: { ...group[index], group, valid: true },
    hidden: group.map((t) => t.id),
    fade: false,
  };
}
