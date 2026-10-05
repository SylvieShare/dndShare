import { tileSize } from "./tilePlacementSize";
export function rotatedSlot(slot, model, rotation) {
  if (rotation === 90)
    return {
      ...slot,
      x: model.height - slot.y - slot.height,
      y: slot.x,
      width: slot.height,
      height: slot.width,
    };
  if (rotation === 180)
    return {
      ...slot,
      x: model.width - slot.x - slot.width,
      y: model.height - slot.y - slot.height,
    };
  if (rotation === 270)
    return {
      ...slot,
      x: slot.y,
      y: model.width - slot.x - slot.width,
      width: slot.height,
      height: slot.width,
    };
  return slot;
}
export const structureCellKey = (x, y, level) => `${x},${y},${level}`;
export function structureContext(document, catalogue) {
  const models = new Map(catalogue.map((m) => [m.id, m])),
    occupied = new Map(),
    sockets = new Map(),
    placements = new Map();
  function check(tile, ignoreId, cells = occupied, supportsMap = sockets) {
    const model = models.get(tile.modelId);
    if (!model)
      return { valid: false, message: "Модель отсутствует в каталоге" };
    if (!Number.isInteger(tile.level) || tile.level < 0 || tile.level > 15)
      return { valid: false, message: "Допустимы уровни от 1 до 16" };
    const size = tileSize(tile, model);
    if (
      tile.x < 0 ||
      tile.y < 0 ||
      tile.x + size.width > document.width ||
      tile.y + size.height > document.height
    )
      return { valid: false, message: "Плитка выходит за границу карты" };
    let elevation = 0;
    const found = [];
    const supports = new Set();
    for (let y = tile.y; y < tile.y + size.height; y++)
      for (let x = tile.x; x < tile.x + size.width; x++) {
        const key = structureCellKey(x, y, tile.level);
        if (cells.has(key) && cells.get(key) !== ignoreId)
          return { valid: false, message: "Здесь уже есть плитка" };
        if (tile.level > 0) {
          const slot = supportsMap.get(key);
          if (slot) {
            found.push(slot);
            elevation = Math.max(elevation, slot.elevation);
          }
        }
      }
    if (tile.level > 0 && !found.length)
      return {
        valid: false,
        message: "Нужен опорный слот хотя бы под одной клеткой плитки",
      };
    for (const slot of found)
      if (Math.abs(slot.elevation - elevation) <= 0.015)
        supports.add(slot.parent);
    return { valid: true, message: "", elevation, supports: [...supports] };
  }
  function register(tile, cells, supportsMap, poses) {
    const result = check(tile, null, cells, supportsMap);
    if (!result.valid) return result;
    poses.set(tile.id, result);
    const model = models.get(tile.modelId),
      size = tileSize(tile, model);
    for (let y = tile.y; y < tile.y + size.height; y++)
      for (let x = tile.x; x < tile.x + size.width; x++)
        cells.set(structureCellKey(x, y, tile.level), tile.id);
    for (const raw of model.supportSlots || []) {
      const slot = rotatedSlot(raw, model, tile.rotation);
      for (let y = slot.y; y < slot.y + slot.height; y++)
        for (let x = slot.x; x < slot.x + slot.width; x++)
          supportsMap.set(
            structureCellKey(tile.x + x, tile.y + y, tile.level + 1),
            {
              elevation:
                result.elevation + slot.elevation - (model.mountDepth || 0),
              parent: tile.id,
            },
          );
    }
    return result;
  }
  let status = { valid: true, message: "" };
  for (const tile of [...document.tiles].sort((a, b) => a.level - b.level)) {
    const result = register(tile, occupied, sockets, placements);
    if (!result.valid) {
      status = result;
      break;
    }
  }
  function checkGroup(tiles) {
    const cells = new Map(occupied),
      supportMap = new Map(sockets),
      poses = new Map(placements);
    for (const tile of [...tiles].sort((a, b) => a.level - b.level)) {
      const result = register(tile, cells, supportMap, poses);
      if (!result.valid) return { ...result, placements: poses };
    }
    return { valid: true, message: "", placements: poses };
  }
  return { status, check, checkGroup, placements, occupied, sockets, models };
}
export function dependentTiles(document, catalogue, ids) {
  const selected = new Set(ids),
    context = structureContext(document, catalogue);
  let changed = true;
  while (changed) {
    changed = false;
    for (const tile of document.tiles) {
      const placement = context.placements.get(tile.id);
      if (
        !selected.has(tile.id) &&
        placement?.supports.some((id) => selected.has(id))
      ) {
        selected.add(tile.id);
        changed = true;
      }
    }
  }
  return [...selected];
}
