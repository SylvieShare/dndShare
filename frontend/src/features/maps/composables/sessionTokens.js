import { computed, ref } from "vue";
import { clone, uid } from "../lib/mapModel";
import { creatureKey, creatureToken } from "../lib/sessionCreatures";
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
  const selected = computed(() =>
    preview.value ? "preview-token" : token.value?.id || "",
  );
  const canvasState = computed(() => {
    const s = getEditor()?.draft.state;
    return preview.value ? { ...s, tokens: [...s.tokens, preview.value] } : s;
  });
  function clear() {
    focused.value = "";
    pending.value = null;
    preview.value = null;
  }
  function clearMapSelection(e) {
    e.clearAreaFocus();
    e.setTileSelection([]);
    e.setObjectSelection([]);
    e.selectedLight = "";
  }
  function focus(c) {
    const e = getEditor();
    if (!e) return;
    e.resetGesture();
    e.tool = "select";
    clearMapSelection(e);
    focused.value = creatureKey(c);
    pending.value = preview.value = null;
    const t = creatureToken(e.draft, c),
      canvas = getCanvas();
    if (t && canvas) {
      canvas.setView({ ...canvas.getView(), fit: false, x: t.x, y: t.y });
      canvas.focus();
    }
  }
  function place(c) {
    const e = getEditor();
    if (!e) return;
    e.resetGesture();
    e.tool = "select";
    focus(c);
    pending.value = c;
  }
  function position(point) {
    return point?.placement && !point.invalidSurface ? point : null;
  }
  function gesture(event, e) {
    const { phase, point, hit } = event;
    if (phase === "hover") {
      if (pending.value) {
        const at = position(point);
        preview.value = at
          ? {
              ...pending.value,
              imageUrl: pending.value.previewUrl || "",
              id: "preview-token",
              ...at,
              size: 1,
              hidden: false,
              physical: false,
            }
          : null;
        return true;
      }
      return false;
    }
    if (phase === "cancel") {
      if (drag?.changed) {
        e.draft = drag.before;
        e.history.pop();
      }
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
        const c = pending.value;
        const placed = {
          kind: c.kind,
          ref: c.ref || "",
          name: c.name,
          imageUrl: c.previewUrl || "",
          color: c.color,
          id: uid(),
          ...at,
          size: 1,
          hidden: false,
          physical: false,
        };
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
      drag = { id: t.id, before: clone(e.draft), changed: false };
      dragging.value = true;
      e.pauseSave(true);
      return true;
    }
    if (!drag) return false;
    if (phase === "move") {
      const at = position(point);
      if (at) {
        if (!drag.changed) {
          e.history.push(drag.before);
          if (e.history.length > 50) e.history.shift();
          e.future = [];
          drag.changed = true;
        }
        Object.assign(
          e.draft.state.tokens.find((t) => t.id === drag.id),
          at,
        );
      }
    }
    if (phase === "end") {
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
