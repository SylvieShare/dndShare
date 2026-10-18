import { computed, ref, watch } from "vue";
import { mapEntity } from "../lib/editorEntities";

// Only navigation from the inspector creates a parent. A new canvas/sidebar
// selection starts a new chain; snapshots contain IDs, never stale model data.
export function useMapFocusHistory(editor, { focusEntries, openArea }) {
  const history = ref([]);
  let navigating = false;
  function snapshot() {
    return editor.focusedArea
      ? { areaId: editor.focusedArea }
      : {
          entries: [
            ...editor.selectedTiles.map((id) => ({ kind: "tile", id })),
            ...editor.selectedObjects.map((id) => ({ kind: "object", id })),
            ...(editor.selectedLight
              ? [{ kind: "light", id: editor.selectedLight }]
              : []),
          ],
        };
  }
  function resolve(value) {
    const document = editor.draft.document;
    if (value.areaId) {
      const area = document.areas.find((a) => a.id === value.areaId);
      return (
        area && {
          kind: "area",
          id: area.id,
          name: area.name,
          color: area.color,
        }
      );
    }
    const entries = value.entries
      .map((entry) =>
        mapEntity(document, editor.catalogue, entry.kind, entry.id),
      )
      .filter(Boolean);
    if (!entries.length) return null;
    return entries.length === 1
      ? entries[0]
      : { kind: "group", name: `Выбрано: ${entries.length}`, entries };
  }
  const parent = computed(() =>
    history.value.map(resolve).filter(Boolean).at(-1),
  );
  watch(
    () => JSON.stringify(snapshot()),
    () => {
      if (!navigating) history.value = [];
    },
    { flush: "sync" },
  );
  function follow(action) {
    const current = snapshot();
    navigating = true;
    try {
      action();
      if (
        JSON.stringify(current) !== JSON.stringify(snapshot()) &&
        resolve(current)
      ) {
        history.value = [...history.value, current].slice(-50);
      }
    } finally {
      navigating = false;
    }
  }
  function back() {
    let value, entry;
    do {
      value = history.value.pop();
      entry = value && resolve(value);
    } while (value && !entry);
    if (!entry) return;
    navigating = true;
    try {
      entry.kind === "area"
        ? openArea(entry.id)
        : focusEntries(entry.entries || [entry]);
    } finally {
      navigating = false;
    }
  }
  return { parent, follow, back };
}
