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
    placementHint: ref(null),
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

it("places a copied stack onto an upper socket and keeps preview IDs distinct", () => {
  const { e, clipboard } = setup();
  const source = { ...e.draft.value.document.tiles[0], modelId: "frame" };
  const child = { ...source, id: "child", modelId: "floor", level: 1 };
  e.catalogue.value.push({
    id: "frame",
    width: 2,
    height: 1,
    supportSlots: [{ x: 0, y: 0, width: 2, height: 1, elevation: 0.6 }],
  });
  e.draft.value.document.tiles = [
    source,
    child,
    { ...source, id: "receiver", x: 4, y: 4 },
  ];
  e.selectedTiles.value = ["old", "child"];
  clipboard.copy();
  clipboard.begin({ x: 5, y: 4.5, level: 1 });
  expect(e.previewTile.value).toMatchObject({ valid: true, level: 1 });
  expect(new Set(e.previewTile.value.group.map((t) => t.id)).size).toBe(2);
  clipboard.paste({ x: 5, y: 4.5, level: 1 });
  expect(e.draft.value.document.tiles.slice(3)).toMatchObject([
    { x: 4, y: 4, level: 1 },
    { x: 4, y: 4, level: 2 },
  ]);
});
it("cancels paste back to selection without consuming the buffer and rotates its preview as a whole", () => {
  const { e, clipboard } = setup();
  e.draft.value.document.tiles.push({
    ...e.draft.value.document.tiles[0],
    id: "second",
    x: 3,
  });
  e.selectedTiles.value.push("second");
  clipboard.copy();
  clipboard.begin({ x: 5.5, y: 4.5 });
  clipboard.rotate();
  expect(e.previewTile.value.group).toMatchObject([
    { x: 5, y: 3, rotation: 90 },
    { x: 5, y: 5, rotation: 90 },
  ]);
  clipboard.cancel();
  expect(e.tool.value).toBe("select");
  expect(e.previewTile.value).toBeNull();
  expect(e.draft.value.document.tiles).toHaveLength(2);
  clipboard.begin({ x: 5.5, y: 4.5 });
  expect(e.previewTile.value.group).toMatchObject([
    { x: 4, y: 4, rotation: 0 },
    { x: 6, y: 4, rotation: 0 },
  ]);
});
