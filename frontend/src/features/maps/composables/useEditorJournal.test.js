import { effectScope, nextTick, ref } from "vue";
import { expect, it } from "vitest";
import { useEditorJournal } from "./useEditorJournal";

it("keeps delta history and acknowledges only the exact in-flight save version", async () => {
  const scope = effectScope(),
    draft = ref({
      revision: 5,
      name: "map",
      document: { tiles: [{ id: "a", x: 0 }] },
    });
  const journal = scope.run(() => useEditorJournal(draft, true));
  journal.checkpoint();
  draft.value.document.tiles[0].x = 1;
  journal.commit();
  await nextTick();
  const savingVersion = journal.revision.value;
  journal.checkpoint();
  draft.value.document.tiles[0].x = 2;
  journal.commit();
  await nextTick();
  journal.acknowledge(savingVersion);
  draft.value.revision = 6;
  await nextTick();
  expect(journal.dirty.value).toBe(true);
  expect(journal.history.value.every((entry) => !entry.before)).toBe(true);
  journal.undo();
  expect(draft.value.document.tiles[0].x).toBe(1);
  expect(draft.value.revision).toBe(6);
  await nextTick();
  expect(journal.dirty.value).toBe(false);
  journal.redo();
  expect(draft.value.document.tiles[0].x).toBe(2);
  scope.stop();
});
it("rolls back failed commands without retaining their history and excludes server metadata from dirty tracking", async () => {
  const scope = effectScope(),
    draft = ref({ revision: 1, name: "map", document: { tiles: [] } });
  const journal = scope.run(() => useEditorJournal(draft, true));
  draft.value.revision = 2;
  await nextTick();
  expect(journal.dirty.value).toBe(false);
  journal.checkpoint();
  draft.value.name = "changed";
  journal.rollback();
  expect(draft.value.name).toBe("map");
  expect(journal.history.value).toHaveLength(0);
  await nextTick();
  expect(journal.dirty.value).toBe(false);
  scope.stop();
});
