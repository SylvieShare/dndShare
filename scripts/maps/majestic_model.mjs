// Catalogue metadata comes from one measured recipe, never a pack-wide footprint guess.
export function majesticModel(info) {
  const r = info.recipe;
  if (!info.footprintReviewed || !r)
    throw new Error("Reviewed footprint and material recipe required");
  return {
    collection: info.collection,
    collectionName: info.collectionName,
    sourceCode: info.code,
    sourceName: info.sourceName,
    name: info.sourceName,
    textureDetail: "detailed",
    tileType: r.tileType,
    hasDecor: r.hasDecor,
    canStand: true,
    hidden: false,
    placementPoints: info.placementPoints,
    wallMode: r.wallMode ?? "none",
    wallMask: r.wallMask ?? 0,
    width: r.width,
    height: r.height,
    placementOffset: [0, 0],
    mountDepth: info.mountDepth,
    surfaceHeight: info.surfaceHeight,
    maxHeight: info.maxHeight,
    blockers: r.blockers ?? [],
    tags: r.tags,
    supportSlots: r.supportSlots ?? [],
  };
}
