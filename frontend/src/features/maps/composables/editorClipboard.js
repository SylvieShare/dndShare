import { clone, inside, uid } from "../lib/mapModel";
import { tileGroupStatus } from "../lib/tilePlacement";
export function editorClipboard(e) {
  let clipboard = null,
    targets = null;
  function copy() {
    const d = e.draft.value.document,
      r = e.selection.value,
      ids = new Set(e.selectedTiles.value);
    const includes = (o) =>
      r &&
      o.x >= r.x &&
      o.y >= r.y &&
      o.x < r.x + r.width &&
      o.y < r.y + r.height;
    const tiles = d.tiles.filter(
      (t) => ids.has(t.id) || (!ids.size && includes(t)),
    );
    const objects = d.objects.filter(
      (o) => o.id === e.selectedObject.value || includes(o),
    );
    if (!tiles.length && !objects.length) return;
    const origin = r || {
      x: Math.min(...tiles.concat(objects).map((t) => t.x)),
      y: Math.min(...tiles.concat(objects).map((t) => t.y)),
    };
    const level = tiles.length ? Math.min(...tiles.map((t) => t.level)) : 0;
    clipboard = {
      tiles: tiles.map((t) => ({
        ...clone(t),
        id: undefined,
        x: t.x - origin.x,
        y: t.y - origin.y,
        level: t.level - level,
      })),
      objects: objects.map((o) => ({
        ...clone(o),
        id: undefined,
        x: o.x - origin.x,
        y: o.y - origin.y,
      })),
    };
  }
  function preview(point) {
    if (!clipboard || !point) return;
    const x = Math.floor(point.x),
      y = Math.floor(point.y),
      level = point.level || 0;
    const tiles = clipboard.tiles.map((t) => ({
      ...t,
      x: x + t.x,
      y: y + t.y,
      level: t.level + level,
    }));
    const objects = clipboard.objects.map((o, i) => ({
      ...o,
      id: `clipboard-object-${i}`,
      x: x + o.x,
      y: y + o.y,
      placing: true,
    }));
    targets = {
      tiles,
      objects,
      valid:
        (!tiles.length ||
          tileGroupStatus(e.draft.value.document, tiles, e.catalogue.value)
            .valid) &&
        objects.every((o) => inside(e.draft.value.document, o.x, o.y)),
    };
    e.previewTile.value = tiles.length
      ? {
          ...tiles[0],
          group: tiles,
          tileIds: [],
          valid: targets.valid,
          clipboard: true,
        }
      : null;
    if (e.previewObject)
      e.previewObject.value = objects.length
        ? { ...objects[0], group: objects }
        : null;
  }
  function begin(point) {
    if (!clipboard) return false;
    e.tileDrag.cancel();
    e.tool.value = "paste";
    e.selectedModel.value = clipboard.tiles[0]?.modelId || "";
    preview(point);
    return true;
  }
  function paste(point) {
    preview(point);
    if (!targets?.valid) {
      e.error.value = "Участок нельзя вставить в эту позицию";
      return;
    }
    const tiles = targets.tiles.map((t) => ({ ...t, id: uid() })),
      objects = targets.objects.map(({ placing, ...o }) => ({
        ...o,
        id: uid(),
      }));
    e.change((m) => {
      m.document.tiles.push(...tiles);
      m.document.objects.push(...objects);
    });
    e.setTileSelection(tiles.map((t) => t.id));
    e.selectedObject.value = objects[0]?.id || "";
    e.tool.value = "select";
    e.previewTile.value = null;
    if (e.previewObject) e.previewObject.value = null;
  }
  return { copy, preview, begin, paste };
}
