import {
  nearestTilePlacement,
  tileGroupStatus,
  tileSize,
} from "../lib/tilePlacement";
import { dependentTiles, structureContext } from "../lib/tileStructure";
import { uid } from "../lib/mapModel";
import { enclosedEmptyCells } from "../lib/enclosedTiles";

export function editorTileDrag(e) {
  let drag = null;
  const model = (id) => e.catalogue.value.find((m) => m.id === id);
  function move(point, { fill = false } = {}) {
    if (!drag) return;
    drag.point = point;
    if (!point) {
      e.previewTile.value = null;
      return;
    }
    drag.fill = fill && !drag.tile.id;
    if (drag.fill) {
      const cells = enclosedEmptyCells(
        {
          ...e.draft.value.document,
          tiles: e.draft.value.document.tiles.filter(
            (t) => t.level === drag.tile.level,
          ),
        },
        point,
        e.catalogue.value,
      );
      const size = tileSize(drag.tile, model(drag.tile.modelId));
      if (cells?.length && size.width === 1 && size.height === 1) {
        drag.targets = cells.map((cell) => ({ ...drag.tile, ...cell }));
        e.previewTile.value = {
          ...drag.targets[0],
          group: drag.targets,
          valid: true,
          fill: true,
        };
        return;
      }
    }
    const { width, height } = tileSize(drag.tile, model(drag.tile.modelId));
    const x = point.x - drag.offset.x - width / 2,
      y = point.y - drag.offset.y - height / 2;
    const nearest = nearestTilePlacement(
      e.draft.value.document,
      { ...drag.tile, x, y },
      e.catalogue.value,
      drag.tiles.map((t) => t.id).filter(Boolean),
      2,
      drag.tiles,
      drag.tile,
    );
    const px = nearest?.x ?? Math.round(x),
      py = nearest?.y ?? Math.round(y);
    const dx = px - drag.tile.x,
      dy = py - drag.tile.y;
    drag.targets = drag.tiles.map((tile) => ({
      ...tile,
      x: tile.x + Math.round(dx),
      y: tile.y + Math.round(dy),
    }));
    const status = tileGroupStatus(
      e.draft.value.document,
      drag.targets,
      e.catalogue.value,
    );
    e.previewTile.value = {
      ...drag.tile,
      tileId: drag.tile.id,
      tileIds: drag.tiles.map((t) => t.id).filter(Boolean),
      x: px,
      y: py,
      valid: status.valid && !drag.fill && !!nearest,
      group: drag.tiles.map((tile) => ({
        ...tile,
        x: tile.x + dx,
        y: tile.y + dy,
      })),
    };
  }
  function begin(modelId, point = null, tile = null) {
    cancel();
    e.tool.value = "select";
    e.selectedModel.value = modelId;
    e.hoveredTile.value = "";
    e.selectedObject.value = "";
    if (!tile || !e.selectedTiles.value.includes(tile.id))
      e.setTileSelection(tile ? [tile.id] : []);
    e.selectedTile.value = tile?.id || "";
    e.selection.value = null;
    e.error.value = "";
    const source = tile
      ? { ...tile }
      : {
          modelId,
          x: 0,
          y: 0,
          rotation: e.placementRotation.value,
          level: e.level.value,
        };
    const size = tileSize(source, model(modelId));
    const groupIds = tile
      ? dependentTiles(
          e.draft.value.document,
          e.catalogue.value,
          e.selectedTiles.value,
        )
      : [];
    const tiles = tile
      ? e.draft.value.document.tiles
          .filter((t) => groupIds.includes(t.id))
          .map((t) => ({ ...t }))
      : [source];
    drag = {
      tile: tiles.find((t) => t.id === source.id) || source,
      tiles,
      offset: tile
        ? {
            x: point.x - tile.x - size.width / 2,
            y: point.y - tile.y - size.height / 2,
          }
        : { x: 0, y: 0 },
    };
    e.draggingTile.value = true;
    e.pauseSave(true);
    move(point);
  }
  function cancel() {
    if (!drag) return;
    drag = null;
    e.draggingTile.value = false;
    e.previewTile.value = null;
    e.pauseSave(false);
  }
  function drop(point, options) {
    if (!drag) return;
    move(point, options);
    if (point) {
      const status = tileGroupStatus(
        e.draft.value.document,
        drag.targets,
        e.catalogue.value,
      );
      if (
        status.valid &&
        e.previewTile.value?.valid &&
        (!drag.fill || e.previewTile.value?.fill)
      ) {
        const placements = drag.targets.map((tile) => ({
          ...tile,
          id: tile.id || uid(),
        }));
        const changed = placements.some((tile) => {
          const old = e.draft.value.document.tiles.find(
            (t) => t.id === tile.id,
          );
          return (
            !old ||
            old.x !== tile.x ||
            old.y !== tile.y ||
            old.level !== tile.level ||
            old.rotation !== tile.rotation
          );
        });
        if (changed)
          e.change((m) => {
            for (const tile of placements) {
              const old = m.document.tiles.find((t) => t.id === tile.id);
              if (old) Object.assign(old, tile);
              else m.document.tiles.push(tile);
            }
          });
        e.setTileSelection(
          placements.map((t) => t.id),
          placements.find((t) => t.id === drag.tile.id)?.id || placements[0].id,
        );
      } else
        e.error.value = drag.fill
          ? "Область не замкнута или не подходит для заполнения"
          : status.message;
    }
    cancel();
  }
  function rotate() {
    if (!drag) return false;
    for (const tile of drag.tiles) tile.rotation = (tile.rotation + 90) % 360;
    e.placementRotation.value = drag.tile.rotation;
    move(drag.point, { fill: drag.fill });
    return true;
  }
  return { begin, move, drop, cancel, rotate };
}
