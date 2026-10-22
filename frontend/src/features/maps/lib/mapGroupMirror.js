import { tileSize } from "./tilePlacementSize";

// Reflection in map X, around the selected footprint's centre. A local X
// reflection before rotation represents both axes without another enum.
export function mirrorTileGroup(tiles, catalogue) {
  if (!tiles.length) return [];
  const models = new Map(catalogue.map((m) => [m.id, m]));
  const bounds = tiles.map((t) => ({
    tile: t,
    size: tileSize(t, models.get(t.modelId)),
  }));
  const axis =
    Math.min(...tiles.map((t) => t.x)) +
    Math.max(...bounds.map(({ tile, size }) => tile.x + size.width));
  return bounds.map(({ tile, size }) => ({
    ...tile,
    x: axis - tile.x - size.width,
    rotation: (360 - tile.rotation) % 360,
    mirrored: !tile.mirrored,
  }));
}
