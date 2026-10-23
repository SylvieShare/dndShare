import { computed, nextTick, ref } from "vue";
import { clone, uid } from "../lib/mapModel";
import { resolvedSurfacePosition } from "../lib/surfacePlacement";
import {
  creatureKey,
  creatureToken,
  withCreaturePortraits,
  withCreatureItems,
} from "../lib/sessionCreatures";
export function sessionTokens(getEditor, candidates, getCanvas) {
  const focused = ref(""),
    pending = ref(null),
    preview = ref(null),
    dragging = ref(false);
  let drag = null;
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
      tokens: withCreatureItems(
        withCreaturePortraits(items, candidates.value),
        candidates.value,
      ),
    };
  });
  function clear() {
    focused.value = "";
    pending.value = null;
    preview.value = null;
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
    return {
      kind: c.kind,
      ...(c.kind === "creature" && c.itemId ? { itemId: c.itemId } : {}),
      ref: c.ref || "",
      name: c.name,
      imageUrl: c.previewUrl || previous?.imageUrl || "",
      color: c.color,
      id: previous?.id || (temporary ? "preview-token" : uid()),
      ...point,
      size: previous?.size || 1,
      hidden: previous?.hidden || false,
      physical: previous?.physical || false,
    };
  }
  function position(point) {
    return (point?.placement || point?.grid) && !point.invalidSurface
      ? {
          x: point.x,
          y: point.y,
          elevation: point.elevation,
          ...(point.placement
            ? { placement: point.placement }
            : { placement: undefined }),
        }
      : null;
  }
  function gesture(event, e) {
    const { phase, point, hit } = event;
    if (phase === "hover") {
      if (pending.value) {
        const at = position(point);
        preview.value = at ? atPosition(at, true) : null;
        return true;
      }
      return false;
    }
    if (phase === "cancel") {
      drag = null;
      dragging.value = false;
      pending.value = preview.value = null;
      e.pauseSave(false);
      return false;
    }
    if (phase === "start") {
      if (pending.value) {
        const at = position(point);
        if (!at) return true;
        const c =
          candidates.value.find(
            (c) => creatureKey(c) === creatureKey(pending.value),
          ) || pending.value;
        const placed = atPosition(at);
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
      drag = { id: t.id, source: clone(t), changed: false };
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
      if (drag.changed && preview.value) {
        const target = preview.value;
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
    getEditor().change((m) => {
      const t = creatureToken(m, candidate.value);
      if (t) update(t);
    });
  }
  function remove() {
    change((t) => {
      getEditor().draft.state.tokens = getEditor().draft.state.tokens.filter(
        (x) => x.id !== t.id,
      );
    });
  }
  return {
    focused,
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
    remove,
    surface: computed(() => !!pending.value || dragging.value),
    reset: () => {
      clear();
      drag = null;
      dragging.value = false;
    },
  };
}
