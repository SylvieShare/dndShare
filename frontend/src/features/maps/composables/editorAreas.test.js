import { expect, it, vi } from "vitest";
import { ref, nextTick } from "vue";
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

it("keeps focused membership selected during edits and hiding, and exits for an individual selection", async () => {
  const { e, areas } = setup();
  areas.selectArea("room");
  expect(areas.focusedArea.value).toBe("room");
  areas.setAreaHidden("room", true);
  expect(e.selectedTiles.value).toEqual(["a"]);
  expect(e.selectedObjects.value).toEqual(["one"]);
  e.draft.value.document.areas[0].tileIds.push("b");
  expect(e.selectedTiles.value).toEqual(["a", "b"]);
  areas.removeAreaMember("room", "object", "one");
  expect(e.selectedObjects.value).toEqual([]);
  await nextTick();
  expect(areas.focusedArea.value).toBe("room");
  e.setTileSelection(["b"]);
  await nextTick();
  expect(areas.focusedArea.value).toBe("");
});
it("focuses empty areas, defaults colors, normalizes custom RGB, and deletes only the area", () => {
  const { e, areas } = setup();
  const id = areas.addArea();
  areas.selectArea(id);
  expect(areas.focusedArea.value).toBe(id);
  expect(e.selectedTiles.value).toEqual([]);
  areas.setAreaColor(id, "#0f8");
  expect(e.draft.value.document.areas.at(-1).color).toBe("#00ff88");
  const edits = e.change.mock.calls.length;
  areas.setAreaColor(id, "bad");
  expect(e.change).toHaveBeenCalledTimes(edits);
  areas.removeArea(id);
  expect(areas.focusedArea.value).toBe("");
  expect(e.draft.value.document.tiles).toHaveLength(2);
  expect(e.draft.value.document.objects).toHaveLength(2);
});
it("membership changes restore the whole focused selection without creating selection history", () => {
  const { e, areas } = setup();
  areas.selectArea("room");
  const before = e.change.mock.calls.length;
  areas.renameArea("room", "Переименованный зал");
  expect(areas.focusedArea.value).toBe("room");
  expect(e.change).toHaveBeenCalledTimes(before + 1);
  areas.clearAreaFocus(true);
  expect(e.selectedTiles.value).toEqual([]);
  expect(e.selectedObjects.value).toEqual([]);
});
