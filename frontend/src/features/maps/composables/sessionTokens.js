import { computed, nextTick, ref } from "vue";
import { clone, uid } from "../lib/mapModel";
import { resolvedSurfacePosition } from "../lib/surfacePlacement";
import { chooseTokenBase } from "../lib/tokenBases";
import { tokenModelId } from "../lib/tokenModels";
import { tokenPlacementIssue } from "../lib/tokenFootprint";
import { tokenPlacementPoints, imageTokenPoint } from "../lib/tokenPlacement";
import {
  creatureKey,
  creatureToken,
  withCreaturePortraits,
  withCreatureItems,
  withCreatureLifeState,
} from "../lib/sessionCreatures";
export function sessionTokens(getEditor, candidates, getCanvas) {
  const focused = ref(""),
    hovered = ref(""),
    pending = ref(null),
    preview = ref(null),
    error = ref(""),
    dragging = ref(false);
  let drag = null;
  let placementPose = {};
  const candidate = computed(
    () =>
      candidates.value.find((c) => creatureKey(c) === focused.value) ||
      getEditor()?.draft.state.tokens.find(
        (t) => creatureKey(t) === focused.value,
      ),
  );
  const token = computed(() =>
    creatureToken(getEditor()?.draft, candidate.value),
  );
  const selected = computed(() => preview.value?.id || token.value?.id || "");
  const placement = computed(() => {
    const c = pending.value || (dragging.value && token.value);
    if (!c) return null;
    const previous = creatureToken(getEditor()?.draft, c);
    return { ...c, id: previous?.id || "preview-token", size: previous?.size || c.size || 1, grabOffset: drag?.grabOffset };
  });
  const canvasState = computed(() => {
    const s = getEditor()?.draft.state;
    if (!s) return s;
    const items = !preview.value
      ? s.tokens
      : s.tokens.some((t) => t.id === preview.value.id)
        ? s.tokens.map((t) => (t.id === preview.value.id ? preview.value : t))
        : [...s.tokens, preview.value];
    return {
      ...s,
      tokens: withCreatureLifeState(withCreatureItems(
        withCreaturePortraits(items, candidates.value),
        candidates.value,
      ), candidates.value).map(t => t.id === preview.value?.id ? { ...t, moving: true } : t),
    };
  });
  function clear() {
    focused.value = "";
    hovered.value = "";
    pending.value = null;
    preview.value = null;
    error.value = "";
  }
  function clearMapSelection(e) {
    e.clearCamera?.();
    e.selectedDecal = "";
    e.clearAreaFocus();
    e.setTileSelection([]);
    e.setObjectSelection([]);
    e.selectedLight = "";
  }
  function focus(c, moveCamera = true) {
    const e = getEditor();
    if (!e) return;
    e.resetGesture();
    e.tool = "select";
    clearMapSelection(e);
    focused.value = creatureKey(c);
    pending.value = preview.value = null;
    const t = creatureToken(e.draft, c);
    placementPose = { rotation: t?.rotation || 0, mirrored: !!t?.mirrored, ...(t?.baseModelId ? { baseModelId: t.baseModelId } : {}) };
    error.value = "";
    if (t && moveCamera)
      nextTick(() => {
        if (focused.value !== creatureKey(c)) return;
        const canvas = getCanvas();
        canvas?.focusAt(
          resolvedSurfacePosition(t, e.draft.document, e.catalogue || []),
        );
        canvas?.focus();
      });
  }
  function place(c) {
    const e = getEditor();
    if (!e) return;
    e.resetGesture();
    e.tool = "select";
    focus(c, false);
    pending.value = c;
  }
  function atPosition(point, temporary = false) {
    const c =
      candidates.value.find(
        (c) => creatureKey(c) === creatureKey(pending.value),
      ) || pending.value;
    const previous = creatureToken(getEditor().draft, c);
    const placed = {
      kind: c.kind,
      ...(c.kind === "creature" && c.itemId ? { itemId: c.itemId } : {}),
      ref: c.ref || "",
      name: `${c.markerLetter ? c.markerLetter + " · " : ""}${c.name}`,
      imageUrl: c.previewUrl || previous?.imageUrl || "",
      color: c.color,
      id: previous?.id || (temporary ? "preview-token" : uid()),
      ...point,
      size: previous?.size || c.size || 1,
      hidden: previous?.hidden || false,
      physical: previous?.physical || false,
      ...placementPose,
    };
    const editor = getEditor();
    if (editor.draft.state.useCreatureBases && tokenModelId(placed, editor.catalogue || [])) {
      const id = chooseTokenBase(placed, editor.catalogue || []);
      if (id) placed.baseModelId = placementPose.baseModelId = id;
    }
    return placed;
  }
  function position(point) {
    if (!point?.placement && !point?.grid) return null;
    const at = {
          x: point.x,
          y: point.y,
          elevation: point.elevation,
          cell: point.cell,
          anchorOffset: point.anchorOffset,
          ...(point.placement
            ? { placement: point.placement }
            : { placement: undefined }),
        };
    const e = getEditor();
    const others = e.draft.state.tokens.map(t => resolvedSurfacePosition(t, e.draft.document, e.catalogue || []));
    const reason = point.invalidReason || tokenPlacementIssue({ ...placement.value, ...at }, e.draft.document, others);
    return { ...at, invalidSurface: !!point.invalidSurface || !!reason, invalidReason: reason };
  }
  function durable(t) {
    const { invalidSurface, invalidReason, moving, cell, ...saved } = t;
    return Object.fromEntries(Object.entries(saved).filter(([,value]) => value !== undefined));
  }
  function gesture(event, e) {
    const { phase, point, hit } = event;
    if (phase === "hover") {
      hovered.value = hit?.tokenId || "";
      if (pending.value) {
        const at = position(point);
        preview.value = at ? atPosition(at, true) : null;
        return true;
      }
      return false;
    }
    if (phase === "cancel") {
      hovered.value = "";
      drag = null;
      dragging.value = false;
      pending.value = preview.value = null;
      e.pauseSave(false);
      return false;
    }
    if (phase === "start") {
      if (pending.value) {
        const at = position(point);
        if (!at || at.invalidSurface) { error.value = at?.invalidReason || "Здесь нельзя поставить существо"; return true; }
        const c =
          candidates.value.find(
            (c) => creatureKey(c) === creatureKey(pending.value),
          ) || pending.value;
        const placed = durable(atPosition(at));
        e.change((m) => {
          m.state.tokens = m.state.tokens.filter(
            (t) => c.kind === "marker" || creatureKey(t) !== creatureKey(c),
          );
          m.state.tokens.push(placed);
        });
        focused.value = creatureKey(placed);
        pending.value = preview.value = null;
        return true;
      }
      const t = e.draft.state.tokens.find((t) => t.id === hit?.tokenId);
      if (!t) return false;
      clearMapSelection(e);
      focused.value = creatureKey(t);
      const posed = resolvedSurfacePosition(t,e.draft.document,e.catalogue || []);
      drag = { id: t.id, source: clone(t), changed: false, grabOffset: point ? { x:point.x-posed.x,y:point.y-posed.y } : null };
      preview.value = clone(t);
      dragging.value = true;
      e.pauseSave(true);
      return true;
    }
    if (!drag) return false;
    if (phase === "move") {
      const at = position(point);
      if (at) {
        drag.changed = true;
        preview.value = { ...drag.source, ...at };
      }
    }
    if (phase === "end") {
      const at = point === undefined ? preview.value : position(point);
      if (drag.changed && at && !at.invalidSurface && preview.value) {
        const target = durable({ ...preview.value, ...at });
        e.change((m) =>
          Object.assign(
            m.state.tokens.find((t) => t.id === drag.id),
            target,
          ),
        );
      }
      preview.value = null;
      drag = null;
      dragging.value = false;
      e.pauseSave(false);
    }
    return true;
  }
  function change(update) {
    const current = token.value;
    if (!current) return false;
    const next = clone(current);
    update(next);
    if (next.size !== current.size) {
      const e = getEditor(), d = e.draft.document;
      const points = d.kind === "image"
        ? [imageTokenPoint(current, next, d, e.draft.state)]
        : tokenPlacementPoints(d, e.catalogue || [], next, e.draft.state);
      const at = points.sort((a, b) => Math.hypot(a.x-current.x,a.y-current.y)-Math.hypot(b.x-current.x,b.y-current.y))[0];
      if (!at || at.invalidSurface) { error.value = at?.invalidReason || "Для этого размера нет свободного места"; return false; }
      Object.assign(next, position(at));
    }
    error.value = "";
    getEditor().change((m) => {
      const t = creatureToken(m, candidate.value);
      if (t) {
        Object.assign(t, durable(next));
        const modelToken = { ...t, itemId: t.itemId || candidate.value?.itemId };
        if ((m.state.useCreatureBases || t.baseModelId) && tokenModelId(modelToken, getEditor().catalogue || [])) {
          const id = chooseTokenBase(t, getEditor().catalogue || []);
          if (id) t.baseModelId = id;
          else delete t.baseModelId;
        }
      }
    });
    return true;
  }
  function transform(update) {
    const current = preview.value || token.value;
    if ((pending.value?.kind || current?.kind) !== "creature") return false;
    if (drag) {
      update(drag.source);
      if (preview.value) update(preview.value);
      else preview.value = clone(drag.source);
      drag.changed = true;
    } else if (pending.value) {
      update(placementPose);
      if (preview.value) update(preview.value);
    } else if (current) change(update);
    else return false;
    return true;
  }
  function remove() {
    const id = token.value?.id;
    if (id) getEditor().change(m => { m.state.tokens = m.state.tokens.filter(t => t.id !== id); });
  }
  return {
    focused,
    hovered,
    error,
    placement,
    candidate,
    token,
    selected,
    pending,
    canvasState,
    clear,
    focus,
    place,
    gesture,
    change,
    rotate: () => transform(t => { t.rotation = ((t.rotation || 0) + 90) % 360; }),
    mirror: () => transform(t => { t.mirrored = !t.mirrored; }),
    remove,
    surface: computed(() => !!pending.value || dragging.value),
    reset: () => {
      clear();
      drag = null;
      dragging.value = false;
    },
  };
}
