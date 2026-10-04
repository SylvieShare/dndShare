import {
  clone,
  flood,
  inside,
  lineCells,
  paint,
  rectangle,
  snap,
  tileAt,
  uid,
} from "../lib/mapModel";

export function editorGestures(e) {
  let gesture = null,
    clipboard = null;
  const doc = () => e.draft.value.document;
  function preview(point) {
    const d = doc();
    e.previewTile.value =
      e.tool.value === "brush" &&
      e.selectedModel.value &&
      inside(d, point.x, point.y)
        ? {
            modelId: e.selectedModel.value,
            x: Math.floor(point.x),
            y: Math.floor(point.y),
            rotation: e.placementRotation.value,
            level: e.level.value,
          }
        : null;
  }
  function draw(point, previous = point) {
    const d = doc(),
      tool = e.tool.value;
    if (d.kind === "tiles" && ["brush", "erase"].includes(tool))
      paint(
        d,
        lineCells(previous, point),
        tool === "erase" ? "" : e.selectedModel.value,
        1,
        e.placementRotation.value,
        e.level.value,
      );
    if (tool === "zone-brush") {
      const zone = d.zones.find((z) => z.id === e.selectedZone.value);
      if (!zone) return;
      const cells = new Set(zone.cells);
      for (const p of lineCells(
        { x: previous.x - d.grid.offsetX, y: previous.y - d.grid.offsetY },
        { x: point.x - d.grid.offsetX, y: point.y - d.grid.offsetY },
      ))
        if (inside(d, p.x, p.y)) cells.add(p.y * Math.ceil(d.width) + p.x);
      zone.cells = [...cells];
    }
  }
  function paste(point) {
    if (!clipboard) return;
    const d = doc(),
      x = Math.floor(point.x),
      y = Math.floor(point.y);
    for (const t of clipboard.tiles)
      paint(d, [{ x: x + t.x, y: y + t.y }], t.modelId, 1, t.rotation, t.level);
    for (const o of clipboard.objects) {
      const next = { ...o, id: uid(), x: o.x + x, y: o.y + y };
      if (inside(d, next.x, next.y)) d.objects.push(next);
    }
  }
  function handle({ phase, point, hit }) {
    const d = doc(),
      tool = e.tool.value;
    if (phase === "hover") {
      preview(point);
      return;
    }
    if (phase === "cancel") {
      if (gesture) {
        e.draft.value = gesture.before;
        e.history.value.pop();
      }
      gesture = null;
      e.selection.value = null;
      e.previewTile.value = null;
      e.pauseSave(false);
      return;
    }
    try {
      if (phase === "start") {
        if (!inside(d, point.x, point.y) && !(tool === "select" && hit)) return;
        e.pauseSave(true);
        gesture = { start: point, last: point, before: clone(e.draft.value) };
        e.checkpoint();
        if (tool === "select") {
          const tile = hit?.tileId
            ? d.tiles.find((t) => t.id === hit.tileId)
            : tileAt(d, point.x, point.y, e.level.value);
          const object = hit?.objectId
            ? d.objects.find((o) => o.id === hit.objectId)
            : [...d.objects]
                .reverse()
                .find(
                  (o) =>
                    Math.hypot(o.x - point.x, o.y - point.y) < o.scale * 0.55,
                );
          e.selectedObject.value = object?.id || "";
          e.selectedTile.value = object ? "" : tile?.id || "";
          if (tile && !object) gesture.tile = { ...tile };
          if (object) gesture.object = { ...object };
        }
        if (tool === "fill")
          flood(
            d,
            point,
            e.selectedModel.value,
            e.placementRotation.value,
            e.level.value,
          );
        if (tool === "object") {
          const p = snap(d, point);
          const o = {
            id: uid(),
            kind: e.objectKind.value,
            ...p,
            scale: 1,
            rotation: 0,
            open: false,
          };
          d.objects.push(o);
          e.selectedObject.value = o.id;
        }
        if (tool === "paste") paste(point);
        draw(point);
      }
      if (phase === "move" && gesture) {
        if (gesture.tile) {
          const tile = d.tiles.find((t) => t.id === gesture.tile.id);
          const x =
            gesture.tile.x + Math.floor(point.x) - Math.floor(gesture.start.x);
          const y =
            gesture.tile.y + Math.floor(point.y) - Math.floor(gesture.start.y);
          if (
            inside(d, x, y) &&
            !d.tiles.some(
              (t) =>
                t.id !== tile.id &&
                t.x === x &&
                t.y === y &&
                t.level === tile.level,
            )
          )
            Object.assign(tile, { x, y });
        } else if (gesture.object)
          Object.assign(
            d.objects.find((o) => o.id === gesture.object.id),
            snap(d, point, gesture.object.scale),
          );
        else {
          draw(point, gesture.last);
          if (["rect", "zone", "select"].includes(tool))
            e.selection.value = rectangle(
              d,
              gesture.start,
              point,
              d.kind !== "image",
            );
        }
        gesture.last = point;
      }
      if (phase === "end" && gesture) {
        const r = rectangle(d, gesture.start, point, d.kind !== "image");
        if (tool === "rect") {
          const cells = [];
          for (let y = r.y; y < r.y + r.height; y++)
            for (let x = r.x; x < r.x + r.width; x++) cells.push({ x, y });
          paint(
            d,
            cells,
            e.selectedModel.value,
            1,
            e.placementRotation.value,
            e.level.value,
          );
        }
        if (tool === "zone") {
          let z = d.zones.find((z) => z.id === e.selectedZone.value);
          if (!z) {
            z = {
              id: uid(),
              name: `Зона ${d.zones.length + 1}`,
              cells: [],
              rects: [],
            };
            d.zones.push(z);
            e.selectedZone.value = z.id;
          }
          z.rects.push(r);
        }
        if (tool !== "select") e.selection.value = null;
        gesture = null;
        e.pauseSave(false);
        preview(point);
      }
    } catch (cause) {
      if (gesture) {
        e.draft.value = gesture.before;
        e.history.value.pop();
      }
      gesture = null;
      e.pauseSave(false);
      e.error.value = cause.message;
    }
  }
  function copy() {
    const r = e.selection.value,
      d = doc();
    if (!r) return;
    const includes = (o) =>
      o.x >= r.x && o.y >= r.y && o.x < r.x + r.width && o.y < r.y + r.height;
    clipboard = {
      tiles: d.tiles
        .filter(includes)
        .map((t) => ({ ...t, x: t.x - r.x, y: t.y - r.y })),
      objects: d.objects
        .filter(includes)
        .map((o) => ({ ...o, x: o.x - r.x, y: o.y - r.y })),
    };
    e.tool.value = "paste";
  }
  function removeSelected() {
    e.change((m) => {
      if (e.selectedTile.value)
        m.document.tiles = m.document.tiles.filter(
          (t) => t.id !== e.selectedTile.value,
        );
      else if (e.selectedObject.value)
        m.document.objects = m.document.objects.filter(
          (o) => o.id !== e.selectedObject.value,
        );
      else if (e.selectedZone.value)
        m.document.zones = m.document.zones.filter(
          (z) => z.id !== e.selectedZone.value,
        );
    });
    e.selectedTile.value = "";
    e.selectedObject.value = "";
  }
  function rotate() {
    const tile = doc().tiles.find((t) => t.id === e.selectedTile.value);
    if (tile && e.tool.value === "select")
      e.change(() => {
        tile.rotation = (tile.rotation + 90) % 360;
      });
    else e.placementRotation.value = (e.placementRotation.value + 90) % 360;
    if (e.previewTile.value)
      e.previewTile.value.rotation = e.placementRotation.value;
  }
  return {
    handle,
    copy,
    removeSelected,
    rotate,
    resetGesture() {
      gesture = null;
    },
  };
}
