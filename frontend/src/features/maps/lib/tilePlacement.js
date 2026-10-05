import { MAX_TILES } from "./mapModel";

export function tileSize(tile, model) {
  const swapped = tile.rotation % 180 !== 0;
  return {
    width: (swapped ? model?.height : model?.width) || 1,
    height: (swapped ? model?.width : model?.height) || 1,
  };
}
export function tilePlacementStatus(document, tile, catalogue, ignoreId) {
  const metadata = (id) => catalogue.find((m) => m.id === id);
  const { width, height } = tileSize(tile, metadata(tile.modelId));
  if (
    tile.x < 0 ||
    tile.y < 0 ||
    tile.x + width > document.width ||
    tile.y + height > document.height
  )
    return { valid: false, message: "Плитка выходит за границу карты" };
  if (!ignoreId && document.tiles.length >= MAX_TILES)
    return { valid: false, message: "На карте может быть до 4096 плиток" };
  for (const other of document.tiles) {
    if (other.id === ignoreId || other.level !== tile.level) continue;
    const size = tileSize(other, metadata(other.modelId));
    if (
      tile.x < other.x + size.width &&
      tile.x + width > other.x &&
      tile.y < other.y + size.height &&
      tile.y + height > other.y
    )
      return { valid: false, message: "Здесь уже есть плитка" };
  }
  return { valid: true, message: "" };
}

export function tileGroupStatus(document, tiles, catalogue) {
  const ids = new Set(tiles.map((t) => t.id).filter(Boolean));
  const check = {
    ...document,
    tiles: document.tiles.filter((t) => !ids.has(t.id)),
  };
  for (const tile of tiles) {
    const status = tilePlacementStatus(check, tile, catalogue);
    if (!status.valid) return status;
    check.tiles.push(tile);
  }
  return { valid: true, message: "" };
}
