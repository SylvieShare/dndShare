export function modelVisual(assets, id, tier = "render") {
  return (
    assets?.visual?.(id, tier) ||
    assets?.model(id, tier) ||
    assets?.model(id, tier === "lod" ? "render" : "lod") ||
    null
  );
}
export function visualSignature(assets, ids, tier = "render") {
  return (
    assets.signature?.(ids, tier) ||
    [...ids].map((id) => [
      !!assets.model(id, tier),
      !!assets.model(id, tier === "lod" ? "render" : "lod"),
    ])
  );
}
