import { surfacePoints, resolvedSurfacePosition } from "./surfacePlacement";
import { structureContext } from "./tileStructure";
import { gridTokenPoint, occupiesCells, occupiedTokenCells, tokenPlacementIssue, tokenSpan } from "./tokenFootprint";

export function tokenPlacementPoints(document, catalogue, token, state, points, context) {
  context ||= structureContext(document, catalogue);
  points ||= surfacePoints(document, catalogue, "", undefined, context);
  if (!occupiesCells(token)) return points;
  const span = tokenSpan(token);
  const tiles = new Map(document.tiles.map(tile => [tile.id, tile]));
  const cells = new Map();
  for (const point of points) {
    const key = `${point.cell.x},${point.cell.y}`;
    if (!cells.has(key)) cells.set(key, []);
    cells.get(key).push(point);
  }
  const others = (state?.tokens || []).map(t => resolvedSurfacePosition(t, document, catalogue, context));
  const occupied = occupiedTokenCells(others, token.id);
  return points.map(point => {
    const centre = span > 1
      ? { x: point.cell.x + span / 2, y: point.cell.y + span / 2 }
      : { x: point.x, y: point.y };
    const tile = tiles.get(point.placement.tileId);
    let dx = centre.x - point.x, dy = centre.y - point.y;
    if (tile.rotation === 90) [dx, dy] = [dy, -dx];
    if (tile.rotation === 180) [dx, dy] = [-dx, -dy];
    if (tile.rotation === 270) [dx, dy] = [-dy, dx];
    if (tile.mirrored) dx = -dx;
    const candidate = { ...point, ...centre, anchorOffset: [dx, dy] };
    let issue = tokenPlacementIssue({ ...token, ...candidate }, document, [], occupied);
    for (let y = 0; !issue && y < span; y++)
      for (let x = 0; !issue && x < span; x++)
        if (!cells.get(`${point.cell.x + x},${point.cell.y + y}`)?.some(p => Math.abs(p.elevation - point.elevation) <= .02))
          issue = "Для всей площади существа нужна опора на одной высоте";
    return { ...candidate, invalidSurface: !!issue, invalidReason: issue };
  });
}

export function imageTokenPoint(point, token, document, state) {
  const candidate = gridTokenPoint(point, occupiesCells(token) ? token.size : 1);
  const issue = tokenPlacementIssue({ ...token, ...candidate }, document, state?.tokens);
  return { ...candidate, invalidSurface: !!issue, invalidReason: issue };
}

export function unoccupiedObjectPoints(document, catalogue, state, points, context) {
  if (!state?.tokens?.length) return points;
  context ||= structureContext(document,catalogue);
  const occupied=occupiedTokenCells(state.tokens.map(t=>resolvedSurfacePosition(t,document,catalogue,context)));
  return points.filter(point=>!tokenPlacementIssue({ ...point,id:"",kind:"player",size:1 },document,[],occupied));
}
