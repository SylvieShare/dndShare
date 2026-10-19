// Presentation changes do not validate placement, load assets or rebuild layers.
export function createSceneSelection(outline, annotations, lighting, preview) {
  let document,
    tiles = new Map(),
    appearance,
    tier;
  return {
    document(next, placed, nextAppearance, nextTier) {
      document = next;
      tiles = new Map(placed.map((tile) => [tile.id, tile]));
      appearance = nextAppearance;
      tier = nextTier;
    },
    update(options, view) {
      if (!document) return;
      const hidden = new Set([
        ...preview.hiddenIds(),
        ...appearance.hiddenTiles,
      ]);
      const ids = new Set([
        ...(options.selectedTiles || [options.selectedTile]),
        options.hoveredTile,
      ]);
      outline.update(
        {
          tiles: [...ids]
            .filter((id) => !hidden.has(id))
            .map((id) => tiles.get(id))
            .filter(Boolean),
        },
        options,
        tier,
      );
      annotations.update(document, options);
      lighting.selection(options, view);
    },
  };
}
