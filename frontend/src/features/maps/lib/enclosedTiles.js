import { MAX_TILES } from "./mapModel";
import { tileSize } from "./tilePlacement";

export function enclosedEmptyCells(document, point, catalogue) {
  const width = document.width,
    height = document.height;
  const x = Math.floor(point.x),
    y = Math.floor(point.y);
  if (x < 0 || y < 0 || x >= width || y >= height) return null;
  const occupied = new Set();
  for (const tile of document.tiles) {
    const size = tileSize(
      tile,
      catalogue.find((m) => m.id === tile.modelId),
    );
    for (let dy = 0; dy < size.height; dy++)
      for (let dx = 0; dx < size.width; dx++)
        occupied.add((tile.y + dy) * width + tile.x + dx);
  }
  const start = y * width + x;
  if (occupied.has(start)) return null;
  const seen = new Set([start]),
    queue = [start];
  for (let index = 0; index < queue.length; index++) {
    const cell = queue[index],
      cx = cell % width,
      cy = Math.floor(cell / width);
    if (cx === 0 || cy === 0 || cx === width - 1 || cy === height - 1)
      return null;
    for (const next of [cell - 1, cell + 1, cell - width, cell + width]) {
      if (!occupied.has(next) && !seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
    if (queue.length + document.tiles.length > MAX_TILES) return null;
  }
  return queue
    .sort((a, b) => a - b)
    .map((cell) => ({ x: cell % width, y: Math.floor(cell / width) }));
}
