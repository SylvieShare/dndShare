import { expect, it, vi } from "vitest";
import { ref } from "vue";
import { editorAreas } from "./editorAreas";
function setup() {
  const e = {
    draft: ref({
      document: {
        tiles: [{ id: "a" }, { id: "b" }],
        objects: [{ id: "one" }, { id: "two" }],
        areas: [
          {
            id: "room",
            name: "Зал",
            hidden: false,
            tileIds: ["a"],
            objectIds: ["one"],
          },
          {
            id: "other",
            name: "Другой зал",
            hidden: false,
            tileIds: ["b"],
            objectIds: ["two"],
          },
        ],
      },
    }),
    selectedTiles: ref(["a", "b"]),
    selectedObjects: ref(["one", "two"]),
    selectedObject: ref("one"),
    selection: ref(null),
    screenSelection: ref(null),
    tool: ref("select"),
    change: vi.fn((fn) => fn(e.draft.value)),
    setTileSelection(ids) {
      e.selectedTiles.value = [...ids];
    },
    setObjectSelection(ids) {
      e.selectedObjects.value = [...ids];
      e.selectedObject.value = ids[0] || "";
    },
  };
  return { e, areas: editorAreas(e) };
}
it("counts only outside members for adding and inside members for removing, with no-op actions excluded from history", () => {
  const { e, areas } = setup();
  expect(areas.areaSelectionCounts("room")).toEqual({ add: 2, remove: 2 });
  areas.addSelectionToArea("room");
  expect(areas.areaSelectionCounts("room")).toEqual({ add: 0, remove: 4 });
  expect(e.draft.value.document.areas[1].tileIds).toEqual([]);
  areas.addSelectionToArea("room");
  areas.removeSelectionFromArea("other");
  expect(e.change).toHaveBeenCalledOnce();
  areas.removeSelectionFromArea("room");
  expect(areas.areaSelectionCounts("room")).toEqual({ add: 4, remove: 0 });
});
it("selects every tile and object of an area, including explicit selection of a hidden area", () => {
  const { e, areas } = setup();
  e.draft.value.document.areas[0].hidden = true;
  areas.selectArea("room");
  expect(e.selectedTiles.value).toEqual(["a"]);
  expect(e.selectedObjects.value).toEqual(["one"]);
  expect(areas.areaSelectionCounts("room")).toEqual({ add: 0, remove: 2 });
  expect(e.change).not.toHaveBeenCalled();
  areas.removeSelectionFromArea("room");
  expect(e.draft.value.document.areas[0].objectIds).toEqual([]);
  expect(e.draft.value.document.objects).toHaveLength(2);
});
