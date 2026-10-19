import {
  inside,
  uid,
  MAX_TILES,
} from "../../../src/features/maps/lib/mapModel";
export function lineCells(a, b) {
  let x = Math.floor(a.x),
    y = Math.floor(a.y);
  const bx = Math.floor(b.x),
    by = Math.floor(b.y),
    dx = Math.abs(bx - x),
    dy = -Math.abs(by - y);
  const sx = x < bx ? 1 : -1,
    sy = y < by ? 1 : -1,
    result = [];
  let error = dx + dy;
  for (let n = 0; n < 1000; n++) {
    result.push({ x, y });
    if (x === bx && y === by) break;
    const e = 2 * error;
    if (e >= dy) {
      error += dy;
      x += sx;
    }
    if (e <= dx) {
      error += dx;
      y += sy;
    }
  }
  return result;
}
export function paint(d, points, modelId, radius = 1, rotation = 0, level = 0) {
  const byCell = new Map(d.tiles.map((t) => [`${t.x},${t.y},${t.level}`, t]));
  for (const p of points) {
    for (let y = p.y; y < p.y + radius; y++) {
      for (let x = p.x; x < p.x + radius; x++) {
        if (!inside(d, x, y)) continue;
        const key = `${x},${y},${level}`;
        if (!modelId) byCell.delete(key);
        else {
          const old = byCell.get(key);
          if (!old && byCell.size >= MAX_TILES)
            throw new Error("На карте может быть до 4096 плиток");
          byCell.set(key, {
            id: old?.id || uid(),
            modelId,
            x,
            y,
            rotation,
            level,
          });
        }
      }
    }
  }
  d.tiles = [...byCell.values()];
}
