import { effectScope, reactive } from "vue";
import { expect, it } from "vitest";
import { useMapFocusHistory } from "./useMapFocusHistory";
function setup() {
  const scope = effectScope();
  const editor = reactive({
    focusedArea: "",
    selectedTiles: ["tile"],
    selectedObjects: [],
    selectedLight: "",
    catalogue: [{ id: "floor", name: "Пол", width: 1, height: 1 }],
    draft: {
      document: {
        width: 10,
        height: 10,
        tiles: [
          { id: "tile", modelId: "floor", x: 1, y: 1, level: 0, rotation: 0 },
        ],
        objects: [],
        lights: [{ id: "lamp", name: "Лампа", x: 2, y: 2, height: 1 }],
        areas: [{ id: "room", name: "Зал" }],
      },
    },
  });
  function select(entries) {
    editor.focusedArea = "";
    editor.selectedTiles = entries
      .filter((e) => e.kind === "tile")
      .map((e) => e.id);
    editor.selectedObjects = [];
    editor.selectedLight = entries.find((e) => e.kind === "light")?.id || "";
  }
  function area(id) {
    editor.focusedArea = id;
  }
  const history = scope.run(() =>
    useMapFocusHistory(editor, { focusEntries: select, openArea: area }),
  );
  return { editor, history, select, area, stop: () => scope.stop() };
}
it("returns through nested links using current names and keeps the restored area focused", () => {
  const { editor, history, select, area, stop } = setup();
  history.follow(() => area("room"));
  history.follow(() => select([{ kind: "light", id: "lamp" }]));
  expect(history.parent.value.name).toBe("Зал");
  editor.draft.document.areas[0].name = "Большой зал";
  expect(history.parent.value.name).toBe("Большой зал");
  history.back();
  expect(editor.focusedArea).toBe("room");
  expect(history.parent.value.name).toBe("Пол");
  history.back();
  expect(editor.selectedTiles).toEqual(["tile"]);
  expect(history.parent.value).toBeUndefined();
  stop();
});
it("skips deleted parents and clears history for a direct selection or Escape", () => {
  const { editor, history, select, area, stop } = setup();
  history.follow(() => area("room"));
  history.follow(() => select([{ kind: "light", id: "lamp" }]));
  editor.draft.document.areas = [];
  history.back();
  expect(editor.selectedTiles).toEqual(["tile"]);
  history.follow(() => select([{ kind: "light", id: "lamp" }]));
  select([]);
  expect(history.parent.value).toBeUndefined();
  stop();
});
