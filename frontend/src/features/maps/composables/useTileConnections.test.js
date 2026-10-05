import { describe, expect, it } from "vitest";
import { effectScope, nextTick, reactive } from "vue";
import catalogue from "../../../../../internal/battlemap/catalogue.json";
import { useTileConnections } from "./useTileConnections";

it("keeps the last matching layout when unsupported points are discarded", async () => {
  const floor = catalogue.find((m) => m.sourceCode === "LC-007");
  const wall = { id: "tile", modelId: floor.id, rotation: 0 };
  const editor = reactive({
    selectedTiles: ["tile"],
    draft: { document: { tiles: [wall] } },
    catalogue,
    change: (fn) => fn(),
  });
  const scope = effectScope();
  const connections = scope.run(() => useTileConnections(editor));
  connections.toggle(0);
  await nextTick();
  expect(editor.draft.document.tiles[0].modelId).toBe(
    catalogue.find((m) => m.sourceCode === "LC-006").id,
  );
  connections.toggle(2);
  await nextTick();
  const last = { ...editor.draft.document.tiles[0] };
  expect(connections.mask.value).toBe(5);
  connections.toggle(1);
  expect(connections.invalid.value).toBe(true);
  expect(editor.draft.document.tiles[0]).toEqual(last);
  editor.selectedTiles = [];
  await nextTick();
  editor.selectedTiles = ["tile"];
  await nextTick();
  expect(connections.mask.value).toBe(5);
  expect(connections.invalid.value).toBe(false);
  expect(editor.draft.document.tiles[0]).toEqual(last);
  scope.stop();
});
