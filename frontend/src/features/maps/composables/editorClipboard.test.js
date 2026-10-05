import { expect, it, vi } from "vitest";
import { ref } from "vue";
import { editorClipboard } from "./editorClipboard";
function setup() {
  const tile = {
    id: "old",
    modelId: "floor",
    x: 1,
    y: 1,
    level: 0,
    rotation: 0,
  };
  const e = {
    draft: ref({
      document: { width: 8, height: 8, tiles: [tile], objects: [] },
    }),
    selection: ref(null),
    selectedTiles: ref(["old"]),
    selectedObject: ref(""),
    tool: ref("select"),
    selectedModel: ref(""),
    previewTile: ref(null),
    previewObject: ref(null),
    catalogue: ref([{ id: "floor", width: 1, height: 1 }]),
    error: ref(""),
    tileDrag: { cancel: vi.fn() },
    setTileSelection: vi.fn(),
    change(fn) {
      fn(e.draft.value);
    },
  };
  return { e, clipboard: editorClipboard(e) };
}
it("keeps a copied snapshot after multiple paste operations and does not paste on copy", () => {
  const { e, clipboard } = setup();
  clipboard.copy();
  expect(e.tool.value).toBe("select");
  e.draft.value.document.tiles[0].x = 2;
  for (const x of [3.5, 5.5]) {
    expect(clipboard.begin({ x, y: 3.5 })).toBe(true);
    clipboard.paste({ x, y: 3.5 });
  }
  expect(e.draft.value.document.tiles.map((t) => t.x)).toEqual([2, 3, 5]);
  expect(new Set(e.draft.value.document.tiles.map((t) => t.id)).size).toBe(3);
});
it("preserves the buffer after a blocked paste", () => {
  const { e, clipboard } = setup();
  clipboard.copy();
  clipboard.begin({ x: 1.5, y: 1.5 });
  clipboard.paste({ x: 1.5, y: 1.5 });
  expect(e.draft.value.document.tiles).toHaveLength(1);
  clipboard.begin({ x: 4.5, y: 4.5 });
  clipboard.paste({ x: 4.5, y: 4.5 });
  expect(e.draft.value.document.tiles).toHaveLength(2);
});
