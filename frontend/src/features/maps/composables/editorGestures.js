import { nearestSurface } from "../lib/surfacePlacement";
import { clone, inside, rectangle, snap, uid } from "../lib/mapModel";
import { tileGroupStatus, tilePlacementStatus } from "../lib/tilePlacement";
import { dependentTiles } from "../lib/tileStructure";
import { editorClipboard } from "./editorClipboard";
import { latestModelVersions } from "../lib/modelVersions";
import { editorGroupRotation } from "./editorGroupRotation";

export function editorGestures(e) {
  let gesture = null;
  const clipboard = editorClipboard(e);
  const rotateGroup = editorGroupRotation(e);
  const doc = () => e.draft.value.document;
  function checkpoint() {
    if (gesture.changed) return;
    e.checkpoint();
    gesture.changed = true;
  }
  function resetGesture() {
    gesture = null;
    e.tileDrag.cancel();
    clipboard.cancel();
    e.hoveredTile.value = "";
    if (e.hoveredObject) e.hoveredObject.value = "";
    e.screenSelection.value = null;
    if (e.previewObject) e.previewObject.value = null;
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
      if (tool === "paste") clipboard.preview(point);
      e.hoveredTile.value = tool === "select" ? hit?.tileId || "" : "";
      if (e.hoveredObject)
        e.hoveredObject.value = tool === "select" ? hit?.objectId || "" : "";
      if (
        e.previewObject &&
        tool === "object" &&
        point &&
        inside(d, point.x, point.y) &&
        !point.invalidSurface
      )
        e.previewObject.value = {
          id: "preview-object",
          kind: e.objectKind.value,
          modelId: e.objectModel?.value || "",
          ...(point.placement ? point : snap(d, point)),
          scale: 1,
          rotation: e.placementRotation.value,
          open: false,
          placing: true,
        };
      else if (e.previewObject && tool === "object")
        e.previewObject.value = null;
      return;
    }
    if (phase === "cancel") {
      cancel();
      return;
    }
    if (tool === "paste") {
      if (phase === "start") clipboard.paste(point);
      return;
    }
    try {
      if (phase === "start") {
        if (tool === "select" && !hit && !event?.metaKey && !event?.ctrlKey) {
          e.setTileSelection([]);
          e.setObjectSelection([]);
        }
        if (!inside(d, point.x, point.y) && !(tool === "select" && hit)) return;
        e.pauseSave(true);
        e.selection.value = null;
        gesture = {
          start: point,
          tool,
          last: point,
          before: clone(e.draft.value),
          screen: event && { x: event.clientX, y: event.clientY },
          additive: !!(event?.metaKey || event?.ctrlKey),
          selection: [...e.selectedTiles.value],
          anchor: hit?.anchor,
        };
        if (tool === "select") {
          const tile = d.tiles.find((t) => t.id === hit?.tileId);
          const object = hit?.objectId
            ? d.objects.find((o) => o.id === hit.objectId)
            : null;
          if (gesture.additive) {
            if (object)
              e.setObjectSelection(
                e.selectedObjects.value.includes(object.id)
                  ? e.selectedObjects.value.filter((id) => id !== object.id)
                  : [...e.selectedObjects.value, object.id],
              );
            if (tile) {
              const ids = e.selectedTiles.value.includes(tile.id)
                ? e.selectedTiles.value.filter((id) => id !== tile.id)
                : [...e.selectedTiles.value, tile.id];
              e.setTileSelection(ids);
            }
          } else if (tile) {
            e.setObjectSelection([]);
            if (!e.selectedTiles.value.includes(tile.id))
              e.setTileSelection([tile.id]);
            e.selectedTile.value = tile.id;
            gesture.tile = { ...tile };
          } else {
            e.setTileSelection([]);
            e.setObjectSelection(object ? [object.id] : []);
          }
          if (object && !gesture.additive) gesture.object = { ...object };
        }
        if (tool === "object") {
          if (point.invalidSurface) {
            e.error.value = "На карте нет доступных точек размещения";
            return;
          }
          checkpoint();
          const o = {
            id: uid(),
            kind: e.objectKind.value,
            modelId: e.objectModel?.value || "",
            ...(point.placement ? point : snap(d, point)),
            scale: 1,
            rotation: e.placementRotation.value,
            open: false,
          };
          d.objects.push(o);
          e.setObjectSelection([o.id]);
          e.setTileSelection([]);
          e.tool.value = "select";
          if (e.previewObject) e.previewObject.value = null;
        }
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
          const target =
            gesture.object.modelId && d.kind === "tiles"
              ? nearestSurface(point, d, e.catalogue.value, gesture.object.id)
              : snap(d, point, gesture.object.scale);
          if (target)
            Object.assign(
              d.objects.find((o) => o.id === gesture.object.id),
              target,
            );
          if (e.previewObject)
            e.previewObject.value = {
              ...d.objects.find((o) => o.id === gesture.object.id),
              moving: true,
            };
        } else if (!gesture.object) {
          if (tool === "select" && moved)
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
        const click =
          event && gesture.screen
            ? Math.hypot(
                event.clientX - gesture.screen.x,
                event.clientY - gesture.screen.y,
              ) < 5
            : !gesture.moved;
        if (
          tool === "select" &&
          gesture.tool === "select" &&
          gesture.anchor &&
          click &&
          !gesture.additive
        ) {
          const candidates = latestModelVersions(e.catalogue.value).filter(
            (m) =>
              m.collection === e.collection.value &&
              m.tileType === "floor" &&
              m.width === 1 &&
              m.height === 1 &&
              !m.wallMask,
          );
          candidates.sort(
            (a, b) =>
              (/^Ground(?: Stones| \d|$)/i.test(b.sourceName) ? 1 : 0) -
                (/^Ground(?: Stones| \d|$)/i.test(a.sourceName) ? 1 : 0) ||
              a.sourceCode.localeCompare(b.sourceCode),
          );
          const model = candidates[0];
          if (model) {
            const tile = {
              id: uid(),
              modelId: model.id,
              x: Math.floor(gesture.anchor.x),
              y: Math.floor(gesture.anchor.y),
              level: gesture.anchor.level,
              rotation: 0,
            };
            const status = tileGroupStatus(d, [tile], e.catalogue.value);
            if (status.valid) {
              e.change((m) => m.document.tiles.push(tile));
              e.setTileSelection([tile.id]);
            } else e.error.value = status.message;
          }
        }
        if (e.draggingTile.value) e.tileDrag.drop(point);
        else if (gesture.tile && !gesture.moved)
          e.setTileSelection([gesture.tile.id]);
        if (e.selectedTiles.value.length) e.selection.value = null;
        if (tool !== "select") e.selection.value = null;
        resetGesture();
      }
    } catch (cause) {
      cancel();
      e.error.value = cause.message;
    }
  }
  function removeSelected() {
    e.tileDrag.cancel();
    const selected = e.selectedTile.value || e.selectedObject.value;
    if (!selected) return;
    e.change((m) => {
      const objects = new Set(e.selectedObjects.value);
      if (e.selectedTiles.value.length) {
        const ids = new Set(
          dependentTiles(m.document, e.catalogue.value, e.selectedTiles.value),
        );
        m.document.tiles = m.document.tiles.filter((t) => !ids.has(t.id));
        m.document.objects = m.document.objects.filter(
          (o) => !objects.has(o.id) && !ids.has(o.placement?.tileId),
        );
      } else if (objects.size)
        m.document.objects = m.document.objects.filter(
          (o) => !objects.has(o.id),
        );
    });
    e.setTileSelection([]);
    e.setObjectSelection([]);
    e.hoveredTile.value = "";
  }
  function rotate() {
    if (clipboard.rotate()) return;
    if (e.tileDrag.rotate()) return;
    if (e.tool.value === "object") {
      e.placementRotation.value = (e.placementRotation.value + 90) % 360;
      if (e.previewObject?.value)
        e.previewObject.value = {
          ...e.previewObject.value,
          rotation: e.placementRotation.value,
        };
      return;
    }
    if (e.selectedTiles.value.length && rotateGroup()) return;
    const objects = doc().objects.filter((o) =>
      e.selectedObjects.value.includes(o.id),
    );
    if (e.tool.value === "select" && objects.length) {
      e.change(() => {
        objects.forEach((object) => {
          object.rotation = (object.rotation + 90) % 360;
        });
      });
      return;
    }
    if (!rotateGroup())
      e.placementRotation.value = (e.placementRotation.value + 90) % 360;
  }
  return {
    handle,
    copy: clipboard.copy,
    beginPaste: clipboard.begin,
    previewPaste: clipboard.preview,
    removeSelected,
    rotate,
    resetGesture,
  };
}
