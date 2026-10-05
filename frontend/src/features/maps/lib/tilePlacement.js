import { MAX_TILES } from "./mapModel";
import { structureContext } from "./tileStructure";
export { tileSize } from "./tilePlacementSize";

export function tilePlacementStatus(document, tile, catalogue, ignoreId) {
  const filtered = ignoreId
    ? { ...document, tiles: document.tiles.filter((t) => t.id !== ignoreId) }
    : document;
  if (!ignoreId && filtered.tiles.length >= MAX_TILES)
    return { valid: false, message: "На карте может быть до 4096 плиток" };
  const context = structureContext(filtered, catalogue);
  return context.status.valid ? context.check(tile) : context.status;
}
export function tileGroupStatus(document, tiles, catalogue) {
  const ids = new Set(tiles.map((t) => t.id).filter(Boolean));
  const full = {
    ...document,
    tiles: [...document.tiles.filter((t) => !ids.has(t.id)), ...tiles],
  };
  if (full.tiles.length > MAX_TILES)
    return { valid: false, message: "На карте может быть до 4096 плиток" };
  return structureContext(full, catalogue).status;
}
export function nearestTilePlacement(
  document,
  tile,
  catalogue,
  ignoreIds = [],
  radius = 2,
  group = null,
  origin = tile,
) {
  const ignored = new Set(ignoreIds);
  const base = {
    ...document,
    tiles: document.tiles.filter((t) => !ignored.has(t.id)),
  };
  const context = structureContext(base, catalogue);
  let best = null,
    distance = Infinity,
    preference = Infinity;
  for (let dy = -radius; dy <= radius; dy++)
    for (let dx = -radius; dx <= radius; dx++) {
      const next = {
        ...tile,
        x: Math.round(tile.x) + dx,
        y: Math.round(tile.y) + dy,
      };
      const translated = group?.map((t) => ({
        ...t,
        x: t.x + next.x - origin.x,
        y: t.y + next.y - origin.y,
      }));
      const result = translated
        ? context.checkGroup(translated)
        : context.check(next);
      const d = (next.x - tile.x) ** 2 + (next.y - tile.y) ** 2;
      const priority = Math.abs(dx) + Math.abs(dy);
      if (
        result.valid &&
        (d < distance - 1e-9 ||
          (Math.abs(d - distance) < 1e-9 && priority < preference))
      ) {
        best = {
          ...next,
          elevation: translated
            ? result.placements.get(tile.id)?.elevation || 0
            : result.elevation,
        };
        distance = d;
        preference = priority;
      }
    }
  return best;
}
