import { computed, ref, shallowRef, watch } from "vue";
import { clone } from "../lib/mapModel";
import { documentChanges, applyDocumentChanges } from "../lib/documentChanges";

export function useEditorJournal(draft, clean) {
  const history = shallowRef([]),
    future = shallowRef([]);
  const revision = ref(clean ? 0 : 1),
    savedRevision = ref(0);
  let acceptedRoot,
    pending,
    sequence = revision.value,
    suppress = false;
  function skipMutationWatch() {
    suppress = true;
    queueMicrotask(() => {
      suppress = false;
    });
  }
  watch(
    () => [
      draft.value.name,
      draft.value.document,
      draft.value.state,
      draft.value.system,
    ],
    () => {
      if (acceptedRoot === draft.value) {
        acceptedRoot = null;
        suppress = false;
        return;
      }
      if (suppress && !pending) {
        suppress = false;
        return;
      }
      suppress = false;
      revision.value = ++sequence;
    },
    { deep: true },
  );
  function commit() {
    if (!pending) return;
    pending.changes = documentChanges(pending.before, draft.value);
    delete pending.before;
    if (!pending.changes.length) {
      history.value = history.value.filter((entry) => entry !== pending);
      revision.value = pending.from;
    } else {
      pending.to = ++sequence;
      revision.value = pending.to;
    }
    skipMutationWatch();
    pending = null;
  }
  return {
    history,
    future,
    revision,
    dirty: computed(() => revision.value !== savedRevision.value),
    checkpoint() {
      commit();
      pending = { before: clone(draft.value), from: revision.value };
      history.value = [...history.value, pending].slice(-50);
      future.value = [];
    },
    commit,
    rollback() {
      if (!pending) return;
      const changes = documentChanges(pending.before, draft.value);
      applyDocumentChanges(draft.value, changes, false);
      revision.value = pending.from;
      skipMutationWatch();
      history.value = history.value.filter((entry) => entry !== pending);
      pending = null;
    },
    undo() {
      commit();
      const entry = history.value.at(-1);
      if (!entry) return false;
      const from = revision.value === entry.to ? entry.from : ++sequence;
      const to = revision.value;
      applyDocumentChanges(draft.value, entry.changes, false);
      revision.value = from;
      skipMutationWatch();
      history.value = history.value.slice(0, -1);
      future.value = [...future.value, { ...entry, from, to }];
      return true;
    },
    redo() {
      const entry = future.value.at(-1);
      if (!entry) return false;
      const from = revision.value;
      const to = from === entry.from ? entry.to : ++sequence;
      applyDocumentChanges(draft.value, entry.changes, true);
      revision.value = to;
      skipMutationWatch();
      future.value = future.value.slice(0, -1);
      history.value = [...history.value, { ...entry, from, to }];
      return true;
    },
    acknowledge(value) {
      savedRevision.value = value;
    },
    accept() {
      pending = null;
      acceptedRoot = draft.value;
      revision.value = ++sequence;
      savedRevision.value = revision.value;
    },
  };
}
