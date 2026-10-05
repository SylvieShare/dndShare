import {
  clone,
  inside,
  lineCells,
  paint,
  rectangle,
  snap,
  uid,
} from "../lib/mapModel";
import { tileGroupStatus, tilePlacementStatus } from "../lib/tilePlacement";

export function editorGestures(e) {
  let gesture = null,
    clipboard = null;
  const doc = () => e.draft.value.document;
  function checkpoint() {
    if (gesture.changed) return;
    e.checkpoint();
    gesture.changed = true;
  }
  function zoneBrush(point, previous = point) {
    if (e.tool.value !== "zone-brush") return;
    const d = doc(),
      zone = d.zones.find((z) => z.id === e.selectedZone.value);
    if (!zone) return;
    checkpoint();
    const cells = new Set(zone.cells);
    for (const p of lineCells(
      { x: previous.x - d.grid.offsetX, y: previous.y - d.grid.offsetY },
      { x: point.x - d.grid.offsetX, y: point.y - d.grid.offsetY },
    ))
      if (inside(d, p.x, p.y)) cells.add(p.y * Math.ceil(d.width) + p.x);
    zone.cells = [...cells];
  }
  function paste(point) {
    if (!clipboard) return;
    const d = doc(),
      x = Math.floor(point.x),
      y = Math.floor(point.y);
    checkpoint();
    for (const t of clipboard.tiles) {
      const placed = { ...t, x: x + t.x, y: y + t.y };
      if (tilePlacementStatus(d, placed, e.catalogue.value).valid)
        paint(d, [placed], t.modelId, 1, t.rotation, t.level);
    }
    for (const o of clipboard.objects) {
      const next = { ...o, id: uid(), x: o.x + x, y: o.y + y };
      if (inside(d, next.x, next.y)) d.objects.push(next);
    }
    e.tool.value = "select";
  }
  function resetGesture() {
    gesture = null;
    e.tileDrag.cancel();
    e.wallBrush?.cancel();
    e.hoveredTile.value = "";
    e.screenSelection.value = null;
    e.pauseSave(false);
  }
  function cancel() {
    if (gesture?.changed) {
      e.draft.value = gesture.before;
      e.history.value.pop();
    }
    resetGesture();
    e.selection.value = null;
  }
  function handle({ phase, point, hit, event, screenRect, regionTiles }) {
    const d = doc(),
      tool = e.tool.value;
    if (phase === "hover") {
      e.hoveredTile.value = tool === "select" ? hit?.tileId || "" : "";
      return;
    }
    if (phase === "cancel") {
      cancel();
      return;
    }
    if (tool === "wall-brush") {
      if (phase === "start" && inside(d, point.x, point.y))
        e.wallBrush.begin(point);
      if (phase === "move") e.wallBrush.move(point);
      if (phase === "end") e.wallBrush.end(point);
      return;
    }
    try {
      if (phase === "start") {
        if (!inside(d, point.x, point.y) && !(tool === "select" && hit)) return;
        e.pauseSave(true);
        e.selection.value = null;
        gesture = {
          start: point,
          last: point,
          before: clone(e.draft.value),
          screen: event && { x: event.clientX, y: event.clientY },
          additive: !!(event?.metaKey || event?.ctrlKey),
          selection: [...e.selectedTiles.value],
        };
        if (tool === "select") {
          const tile = d.tiles.find((t) => t.id === hit?.tileId);
          const object = hit?.objectId
            ? d.objects.find((o) => o.id === hit.objectId)
            : null;
          e.selectedObject.value = object?.id || "";
          if (gesture.additive) {
            if (tile) {
              const ids = e.selectedTiles.value.includes(tile.id)
                ? e.selectedTiles.value.filter((id) => id !== tile.id)
                : [...e.selectedTiles.value, tile.id];
              e.setTileSelection(ids);
            }
          } else if (tile) {
            if (!e.selectedTiles.value.includes(tile.id))
              e.setTileSelection([tile.id]);
            e.selectedTile.value = tile.id;
            gesture.tile = { ...tile };
          } else e.setTileSelection([]);
          if (object) gesture.object = { ...object };
        }
        if (tool === "object") {
          checkpoint();
          const o = {
            id: uid(),
            kind: e.objectKind.value,
            ...snap(d, point),
            scale: 1,
            rotation: 0,
            open: false,
          };
          d.objects.push(o);
          e.selectedObject.value = o.id;
          e.setTileSelection([]);
          e.tool.value = "select";
        }
        if (tool === "paste") paste(point);
        zoneBrush(point);
      }
      if (phase === "move" && gesture) {
        const moved =
          event && gesture.screen
            ? Math.hypot(
                event.clientX - gesture.screen.x,
                event.clientY - gesture.screen.y,
              ) >= 5
            : Math.hypot(
                point.x - gesture.start.x,
                point.y - gesture.start.y,
              ) >= 0.05;
        if (moved) gesture.moved = true;
        if (gesture.tile) {
          if (!e.draggingTile.value && moved)
            e.tileDrag.begin(gesture.tile.modelId, gesture.start, gesture.tile);
          if (e.draggingTile.value) e.tileDrag.move(point);
        } else if (gesture.object && moved) {
          checkpoint();
          Object.assign(
            d.objects.find((o) => o.id === gesture.object.id),
            snap(d, point, gesture.object.scale),
          );
        } else if (!gesture.object) {
          zoneBrush(point, gesture.last);
          if (["zone", "select"].includes(tool) && moved)
            e.selection.value = rectangle(
              d,
              gesture.start,
              point,
              d.kind !== "image",
            );
          if (tool === "select" && screenRect && moved) {
            e.screenSelection.value = screenRect;
            e.setTileSelection([
              ...(gesture.additive ? gesture.selection : []),
              ...(regionTiles || []),
            ]);
          }
        }
        gesture.last = point;
      }
      if (phase === "end" && gesture) {
        if (e.draggingTile.value) e.tileDrag.drop(point);
        else if (gesture.tile && !gesture.moved)
          e.setTileSelection([gesture.tile.id]);
        if (e.selectedTiles.value.length) e.selection.value = null;
        if (tool === "zone") {
          checkpoint();
          let zone = d.zones.find((z) => z.id === e.selectedZone.value);
          if (!zone) {
            zone = {
              id: uid(),
              name: `Зона ${d.zones.length + 1}`,
              cells: [],
              rects: [],
            };
            d.zones.push(zone);
            e.selectedZone.value = zone.id;
          }
          zone.rects.push(
            rectangle(d, gesture.start, point, d.kind !== "image"),
          );
        }
        if (tool !== "select") e.selection.value = null;
        resetGesture();
      }
    } catch (cause) {
      cancel();
      e.error.value = cause.message;
    }
  }
  function copy() {
    const r = e.selection.value,
      d = doc();
    const selected = new Set(e.selectedTiles.value);
    if (!r && !selected.size) return;
    const tiles = selected.size
      ? d.tiles.filter((t) => selected.has(t.id))
      : d.tiles;
    const origin = r || {
      x: Math.min(...tiles.map((t) => t.x)),
      y: Math.min(...tiles.map((t) => t.y)),
    };
    const includes = (o) =>
      o.x >= r.x && o.y >= r.y && o.x < r.x + r.width && o.y < r.y + r.height;
    clipboard = {
      tiles: tiles
        .filter((t) => selected.size || includes(t))
        .map((t) => ({ ...t, x: t.x - origin.x, y: t.y - origin.y })),
      objects: r
        ? d.objects
            .filter(includes)
            .map((o) => ({ ...o, x: o.x - origin.x, y: o.y - origin.y }))
        : [],
    };
    e.tool.value = "paste";
  }
  function removeSelected() {
    e.tileDrag.cancel();
    const selected =
      e.selectedTile.value ||
      e.selectedObject.value ||
      (e.tool.value.startsWith("zone") ? e.selectedZone.value : "");
    if (!selected) return;
    e.change((m) => {
      if (e.selectedTiles.value.length)
        m.document.tiles = m.document.tiles.filter(
          (t) => !e.selectedTiles.value.includes(t.id),
        );
      else if (e.selectedObject.value)
        m.document.objects = m.document.objects.filter(
          (o) => o.id !== selected,
        );
      else m.document.zones = m.document.zones.filter((z) => z.id !== selected);
    });
    e.setTileSelection([]);
    e.selectedObject.value = "";
    e.hoveredTile.value = "";
  }
  function rotate() {
    if (e.tileDrag.rotate()) return;
    const tiles = doc().tiles.filter((t) =>
      e.selectedTiles.value.includes(t.id),
    );
    if (tiles.length && e.tool.value === "select") {
      const rotated = tiles.map((tile) => ({
        ...tile,
        rotation: (tile.rotation + 90) % 360,
      }));
      const status = tileGroupStatus(doc(), rotated, e.catalogue.value);
      if (status.valid)
        e.change(() =>
          rotated.forEach((tile, i) => Object.assign(tiles[i], tile)),
        );
      else e.error.value = status.message;
    } else e.placementRotation.value = (e.placementRotation.value + 90) % 360;
  }
  return { handle, copy, removeSelected, rotate, resetGesture };
}
