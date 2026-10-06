import {
  nearestSurface,
  resolvedSurfacePosition,
} from "../lib/surfacePlacement";
import { clone, inside, uid } from "../lib/mapModel";
import { tileGroupStatus, tileSize } from "../lib/tilePlacement";
import { groupRotationPivot, rotateMapGroup } from "../lib/mapGroupRotation";
import { hiddenAreaMembers } from "../lib/mapAreas";
export function editorClipboard(e) {
  let clipboard = null,
    targets = null,
    payload = null,
    lastPoint = null,
    pivot = null;
  function copy() {
    const d = e.draft.value.document,
      r = e.selection.value,
      ids = new Set(e.selectedTiles.value);
    const hidden = hiddenAreaMembers(d);
    const includes = (o) =>
      r &&
      o.x >= r.x &&
      o.y >= r.y &&
      o.x < r.x + r.width &&
      o.y < r.y + r.height;
    const tiles = d.tiles.filter(
      (t) =>
        !hidden.tiles.has(t.id) &&
        (ids.has(t.id) || (!ids.size && includes(t))),
    );
    const objects = d.objects.filter(
      (o) =>
        !hidden.objects.has(o.id) &&
        (o.id === e.selectedObject.value ||
          includes(o) ||
          tiles.some((t) => t.id === o.placement?.tileId)),
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
        originalId: t.id,
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
  function placementContext() {
    const root = [...payload.tiles].sort((a, b) => a.level - b.level)[0];
    const size = root
      ? tileSize(
          root,
          e.catalogue.value.find((m) => m.id === root.modelId),
        )
      : null;
    const anchor =
      payload.tiles.length === 1 && !payload.objects.length
        ? { x: root.x + size.width / 2, y: root.y + size.height / 2 }
        : pivot;
    const hint = root
      ? {
          rotation: root.rotation,
          grabOffset: {
            x: anchor.x - root.x - size.width / 2,
            y: anchor.y - root.y - size.height / 2,
          },
        }
      : null;
    return { root, anchor, hint };
  }
  function preview(point) {
    lastPoint = point;
    targets = null;
    e.previewTile.value = null;
    if (e.previewObject) e.previewObject.value = null;
    if (!payload || !point) return;
    const { root, anchor, hint } = placementContext();
    for (const candidate of point.candidates || [point]) {
      const x = root
        ? Math.round(candidate.x - anchor.x)
        : candidate.x - anchor.x;
      const y = root
        ? Math.round(candidate.y - anchor.y)
        : candidate.y - anchor.y;
      const tiles = payload.tiles.map((t) => ({
        ...t,
        x: x + t.x,
        y: y + t.y,
        level: t.level + (candidate.level || 0),
      }));
      const objects = payload.objects.map((o, i) => ({
        ...o,
        placement:
          o.placement &&
          payload.tiles.some((t) => t.originalId === o.placement.tileId)
            ? {
                ...o.placement,
                tileId: payload.tiles.find(
                  (t) => t.originalId === o.placement.tileId,
                ).id,
              }
            : o.placement,
        id: `clipboard-object-${i}`,
        x: x + o.x,
        y: y + o.y,
        placing: true,
      }));
      const previewDocument = {
        ...e.draft.value.document,
        tiles: [...e.draft.value.document.tiles, ...tiles],
        objects: [...e.draft.value.document.objects],
      };
      for (const object of objects) {
        if (!object.modelId || previewDocument.kind !== "tiles") continue;
        if (tiles.some((t) => t.id === object.placement?.tileId))
          Object.assign(
            object,
            resolvedSurfacePosition(object, previewDocument, e.catalogue.value),
          );
        else {
          const surface = nearestSurface(
            object,
            previewDocument,
            e.catalogue.value,
          );
          if (surface) Object.assign(object, surface);
          else object.invalidSurface = true;
        }
        previewDocument.objects.push(object);
      }
      const valid =
        !objects.some((o) => o.invalidSurface) &&
        (!tiles.length ||
          tileGroupStatus(e.draft.value.document, tiles, e.catalogue.value)
            .valid) &&
        objects.every((o) => inside(e.draft.value.document, o.x, o.y));
      targets = { tiles, objects, valid };
      if (valid) break;
    }
    const primary = targets.tiles.find((t) => t.id === root?.id);
    e.previewTile.value = primary
      ? {
          ...primary,
          group: targets.tiles,
          tileIds: [],
          valid: targets.valid,
          clipboard: true,
          ...hint,
        }
      : null;
    if (e.previewObject)
      e.previewObject.value = targets.objects.length
        ? { ...targets.objects[0], group: targets.objects }
        : null;
  }
  function begin(point) {
    if (!clipboard) return false;
    e.tileDrag.cancel();
    e.tool.value = "paste";
    payload = clone(clipboard);
    payload.tiles.forEach((t, i) => {
      t.id = `clipboard-tile-${i}`;
    });
    pivot = groupRotationPivot(
      payload.tiles,
      payload.objects,
      e.catalogue.value,
    );
    const { root, hint } = placementContext();
    e.selectedModel.value = root?.modelId || "";
    e.placementHint.value = hint;
    preview(point);
    return true;
  }
  function paste(point) {
    preview(point);
    if (!targets?.valid) {
      e.error.value = "Участок нельзя вставить в эту позицию";
      return;
    }
    const mapping = new Map(targets.tiles.map((t) => [t.id, uid()]));
    const tiles = targets.tiles.map(({ originalId, ...t }) => ({
        ...t,
        id: mapping.get(t.id),
      })),
      objects = targets.objects.map(({ placing, invalidSurface, ...o }) => ({
        ...o,
        placement:
          o.placement && mapping.has(o.placement.tileId)
            ? { ...o.placement, tileId: mapping.get(o.placement.tileId) }
            : o.placement,
        id: uid(),
      }));
    e.error.value = "";
    e.change((m) => {
      m.document.tiles.push(...tiles);
      m.document.objects.push(...objects);
    });
    e.setTileSelection(tiles.map((t) => t.id));
    e.selectedObject.value = objects[0]?.id || "";
    cancel();
  }
  function cancel() {
    if (e.tool.value !== "paste") return;
    e.tool.value = "select";
    if (e.error.value === "Участок нельзя вставить в эту позицию")
      e.error.value = "";
    payload = targets = lastPoint = null;
    e.placementHint.value = null;
    e.previewTile.value = null;
    if (e.previewObject) e.previewObject.value = null;
  }
  function rotate() {
    if (e.tool.value !== "paste" || !payload) return false;
    payload =
      payload.tiles.length === 1 && !payload.objects.length
        ? {
            ...payload,
            tiles: payload.tiles.map((t) => ({
              ...t,
              rotation: (t.rotation + 90) % 360,
            })),
          }
        : rotateMapGroup(
            payload.tiles,
            payload.objects,
            e.catalogue.value,
            pivot,
          );
    e.placementHint.value = placementContext().hint;
    preview(lastPoint);
    return true;
  }
  return { copy, preview, begin, paste, cancel, rotate };
}
