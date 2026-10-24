export const tokenSpan = (token) => Math.max(1, Math.ceil(token.size || 1));
export const occupiesCells = (token) => ["player", "creature"].includes(token.kind);

// A missing offset derives the centre of the full footprint from the anchor's
// local cell. Physical standing points remain authoritative for one-cell tokens.
export function tokenAnchorOffset(token, point, tile = {}) {
  if (!occupiesCells(token)) return [0, 0];
  if (token.anchorOffset) return token.anchorOffset;
  const span = tokenSpan(token);
  if (span <= 1 || !point.cell) return [0, 0];
  let dx = (span-1)/2, dy = dx;
  if (tile.rotation === 90) [dx,dy]=[dy,-dx];
  if (tile.rotation === 180) [dx,dy]=[-dx,-dy];
  if (tile.rotation === 270) [dx,dy]=[-dy,dx];
  if (tile.mirrored) dx=-dx;
  return [point.cell.x+.5-point.x+dx,point.cell.y+.5-point.y+dy];
}

export function tokenBounds(token) {
  const span = tokenSpan(token);
  const x = span === 1 ? (token.cell?.x ?? Math.floor(token.x)) : Math.round(token.x - span / 2);
  const y = span === 1 ? (token.cell?.y ?? Math.floor(token.y)) : Math.round(token.y - span / 2);
  return { x, y, width: span, height: span };
}

export function occupiedTokenCells(tokens, ignoredId) {
  const cells = new Map();
  for (const token of tokens) {
    if (token.id === ignoredId || !occupiesCells(token)) continue;
    const bounds = tokenBounds(token);
    for (let y=bounds.y;y<bounds.y+bounds.height;y++)
      for (let x=bounds.x;x<bounds.x+bounds.width;x++) {
        const key=`${x},${y}`;
        if (!cells.has(key)) cells.set(key,[]);
        cells.get(key).push(token.elevation ?? .44);
      }
  }
  return cells;
}

export function tokenPlacementIssue(token, document, tokens = [], occupied) {
  if (!occupiesCells(token)) return "";
  const b = tokenBounds(token);
  if (b.x < 0 || b.y < 0 || b.x + b.width > document.width || b.y + b.height > document.height)
    return "Существо выходит за границы карты";
  occupied ||= occupiedTokenCells(tokens, token.id);
  for (let y=b.y;y<b.y+b.height;y++)
    for (let x=b.x;x<b.x+b.width;x++)
      if (occupied.get(`${x},${y}`)?.some(height => Math.abs(height-(token.elevation ?? .44)) <= .05))
        return "Клетки заняты другим существом";
  return "";
}

export function gridTokenPoint(point, size) {
  const span = tokenSpan({ size });
  return {
    x: Math.floor(point.x - span / 2 + .5) + span / 2,
    y: Math.floor(point.y - span / 2 + .5) + span / 2,
    elevation: point.elevation ?? .44,
    grid: true,
  };
}
