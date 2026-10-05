import { inside, lineCells, uid } from "../lib/mapModel";
import { connectionVariant } from "../lib/tileConnections";
import { tileGroupStatus } from "../lib/tilePlacement";

export function editorWallBrush(e) {
  let cells = null,
    last = null,
    targets = null,
    status = null;
  const directions = [
    [0, -1, 0],
    [1, 0, 2],
    [0, 1, 4],
    [-1, 0, 6],
  ];
  const key = (x, y) => `${x},${y}`;
  function update() {
    const document = e.draft.value.document;
    const seed = e.catalogue.value.find(
      (m) =>
        m.tileType === "wall" &&
        m.collection === (e.collection?.value || "lost-cave") &&
        m.wallLayout === "straight",
    );
    if (!seed) {
      e.error.value = "В каталоге нет стен";
      return;
    }
    const walls = new Set(
      document.tiles
        .filter(
          (t) =>
            e.catalogue.value.find((m) => m.id === t.modelId)?.tileType ===
            "wall",
        )
        .map((t) => key(t.x, t.y)),
    );
    for (const cell of cells) walls.add(cell);
    const affected = new Set(cells);
    for (const cell of cells) {
      const [x, y] = cell.split(",").map(Number);
      for (const [dx, dy] of directions)
        if (walls.has(key(x + dx, y + dy))) affected.add(key(x + dx, y + dy));
    }
    targets = [];
    for (const cell of affected) {
      const [x, y] = cell.split(",").map(Number);
      const old = document.tiles.find(
        (t) => t.x === x && t.y === y && t.level === e.level.value,
      );
      const source =
        old &&
        e.catalogue.value.find((m) => m.id === old.modelId)?.tileType === "wall"
          ? old
          : { modelId: seed.id, rotation: 0 };
      let mask = 0;
      for (const [dx, dy, bit] of directions)
        if (walls.has(key(x + dx, y + dy))) mask |= 1 << bit;
      const variant = connectionVariant(source, mask || 1, e.catalogue.value);
      if (!variant) continue;
      targets.push({
        id: old?.id,
        modelId: variant.modelId,
        x,
        y,
        rotation: variant.rotation,
        level: e.level.value,
      });
    }
    status = tileGroupStatus(document, targets, e.catalogue.value);
    e.previewTile.value = targets.length
      ? {
          ...targets[0],
          wallBrush: true,
          group: targets,
          tileIds: targets.map((t) => t.id).filter(Boolean),
          valid: status.valid,
        }
      : null;
  }
  function move(point) {
    if (!cells || !point) return;
    const path = lineCells(last || point, point);
    for (const [index, cell] of path.entries()) {
      const previous = path[index - 1];
      if (
        previous &&
        previous.x !== cell.x &&
        previous.y !== cell.y &&
        inside(e.draft.value.document, cell.x, previous.y)
      )
        cells.add(key(cell.x, previous.y));
      if (inside(e.draft.value.document, cell.x, cell.y))
        cells.add(key(cell.x, cell.y));
    }
    last = point;
    update();
  }
  function begin(point) {
    cells = new Set();
    last = point;
    e.setTileSelection([]);
    e.selectedObject.value = "";
    e.hoveredTile.value = "";
    e.selection.value = null;
    e.error.value = "";
    e.pauseSave(true);
    move(point);
  }
  function cancel() {
    cells = null;
    last = null;
    targets = null;
    if (e.previewTile.value?.wallBrush) e.previewTile.value = null;
    e.pauseSave(false);
  }
  function end(point) {
    if (!cells) return;
    move(point);
    if (status?.valid && targets?.length) {
      const placements = targets.map((tile) => ({
        ...tile,
        id: tile.id || uid(),
      }));
      e.change((map) => {
        for (const tile of placements) {
          const old = map.document.tiles.find((t) => t.id === tile.id);
          if (old) Object.assign(old, tile);
          else map.document.tiles.push(tile);
        }
      });
    } else if (status?.message) e.error.value = status.message;
    cancel();
  }
  return { begin, move, end, cancel };
}
