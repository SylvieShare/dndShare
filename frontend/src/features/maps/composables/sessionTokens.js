import { computed, nextTick, ref } from "vue";
import { clone, uid } from "../lib/mapModel";
import { resolvedSurfacePosition } from "../lib/surfacePlacement";
import { chooseTokenBase } from "../lib/tokenBases";
import { tokenModelId } from "../lib/tokenModels";
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
      ), candidates.value),
    };
  });
  function clear() {
    focused.value = "";
    hovered.value = "";
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
    placementPose = { rotation: t?.rotation || 0, mirrored: !!t?.mirrored, ...(t?.baseModelId ? { baseModelId: t.baseModelId } : {}) };
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
      size: previous?.size || 1,
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
      if (t) {
        update(t);
        const modelToken = { ...t, itemId: t.itemId || candidate.value?.itemId };
        if ((m.state.useCreatureBases || t.baseModelId) && tokenModelId(modelToken, getEditor().catalogue || [])) {
          const id = chooseTokenBase(t, getEditor().catalogue || []);
          if (id) t.baseModelId = id;
          else delete t.baseModelId;
        }
      }
    });
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
    change((t) => {
      getEditor().draft.state.tokens = getEditor().draft.state.tokens.filter(
        (x) => x.id !== t.id,
      );
    });
  }
  return {
    focused,
    hovered,
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
