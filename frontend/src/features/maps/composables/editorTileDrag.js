import {
  nearestTilePlacement,
  tileGroupStatus,
  tileSize,
} from "../lib/tilePlacement";
import { dependentTiles, structureContext } from "../lib/tileStructure";
import { groupRotationPivot, rotateMapGroup } from "../lib/mapGroupRotation";
import { syncSurfaceObjects } from "../lib/surfacePlacement";
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
    const targetLevel = point.level ?? drag.tile.level;
    if (drag.fill) {
      const cells = enclosedEmptyCells(
        {
          ...e.draft.value.document,
          tiles: e.draft.value.document.tiles.filter(
            (t) => t.level === targetLevel,
          ),
        },
        point,
        e.catalogue.value,
      );
      const size = tileSize(drag.tile, model(drag.tile.modelId));
      if (cells?.length && size.width === 1 && size.height === 1) {
        drag.targets = cells.map((cell) => ({
          ...drag.tile,
          ...cell,
          level: targetLevel,
        }));
        const valid = tileGroupStatus(
          e.draft.value.document,
          drag.targets,
          e.catalogue.value,
        ).valid;
        e.previewTile.value = {
          ...drag.targets[0],
          group: drag.targets,
          valid,
          fill: true,
        };
        return;
      }
    }
    const { width, height } = tileSize(drag.tile, model(drag.tile.modelId));
    let x,
      y,
      level = targetLevel,
      nearest = null;
    for (const candidate of point.candidates || [point]) {
      x = candidate.x - drag.offset.x - width / 2;
      y = candidate.y - drag.offset.y - height / 2;
      level = candidate.level ?? drag.tile.level;
      nearest = nearestTilePlacement(
        e.draft.value.document,
        { ...drag.tile, x, y, level },
        e.catalogue.value,
        drag.tiles.map((t) => t.id).filter(Boolean),
        2,
        drag.tiles,
        drag.tile,
      );
      if (nearest) break;
    }
    const px = nearest?.x ?? Math.round(x),
      py = nearest?.y ?? Math.round(y);
    const dx = px - drag.tile.x,
      dy = py - drag.tile.y,
      dl = (nearest?.level ?? level) - drag.tile.level;
    drag.targets = drag.tiles.map((tile) => ({
      ...tile,
      x: tile.x + Math.round(dx),
      y: tile.y + Math.round(dy),
      level: tile.level + dl,
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
      level: drag.tile.level + dl,
      grabOffset: drag.offset,
      grabHeight: drag.grabHeight,
      levelOffset: drag.tile.level - drag.root.level,
      supportBounds: {
        x: drag.root.x - drag.tile.x,
        y: drag.root.y - drag.tile.y,
        ...tileSize(drag.root, model(drag.root.modelId)),
      },
      valid: status.valid && !drag.fill && !!nearest,
      group: drag.tiles.map((tile) => ({
        ...tile,
        x: tile.x + dx,
        y: tile.y + dy,
        level: tile.level + dl,
      })),
    };
  }
  function begin(modelId, point = null, tile = null) {
    cancel();
    e.tool.value = "select";
    e.selectedModel.value = modelId;
    e.hoveredTile.value = "";
    e.setObjectSelection([]);
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
          level: 0,
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
    const root = tiles.reduce((a, b) => (b.level < a.level ? b : a), tiles[0]);
    drag = {
      root,
      tile: tiles.find((t) => t.id === source.id) || source,
      tiles,
      offset: tile
        ? {
            x: point.x - tile.x - size.width / 2,
            y: point.y - tile.y - size.height / 2,
          }
        : { x: 0, y: 0 },
      grabHeight: tile
        ? Math.max(
            0,
            (point.elevation ?? 0.44) -
              (structureContext(
                e.draft.value.document,
                e.catalogue.value,
              ).placements.get(root.id)?.elevation || 0),
          )
        : undefined,
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
              if (old) {
                const turn = tile.rotation - old.rotation;
                for (const object of m.document.objects)
                  if (object.placement?.tileId === tile.id)
                    object.rotation = (object.rotation + turn + 360) % 360;
                Object.assign(old, tile);
              } else m.document.tiles.push(tile);
            }
            syncSurfaceObjects(m.document, e.catalogue.value);
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
    if (drag.tiles.length === 1)
      drag.tile.rotation = (drag.tile.rotation + 90) % 360;
    else {
      drag.pivot ||= groupRotationPivot(drag.tiles, [], e.catalogue.value);
      const size = tileSize(drag.tile, model(drag.tile.modelId));
      const grab = {
        x: drag.tile.x + size.width / 2 + drag.offset.x,
        y: drag.tile.y + size.height / 2 + drag.offset.y,
      };
      const id = drag.tile.id,
        rootId = drag.root.id;
      drag.tiles = rotateMapGroup(
        drag.tiles,
        [],
        e.catalogue.value,
        drag.pivot,
      ).tiles;
      drag.tile = drag.tiles.find((t) => t.id === id);
      drag.root = drag.tiles.find((t) => t.id === rootId);
      const rotatedSize = tileSize(drag.tile, model(drag.tile.modelId));
      drag.offset = {
        x: grab.x - drag.tile.x - rotatedSize.width / 2,
        y: grab.y - drag.tile.y - rotatedSize.height / 2,
      };
    }
    e.placementRotation.value = drag.tile.rotation;
    move(drag.point, { fill: drag.fill });
    return true;
  }
  return { begin, move, drop, cancel, rotate };
}
