import { describe, expect, it } from "vitest";
import { ref } from "vue";
import catalogue from "../../../../../internal/battlemap/catalogue.json";
import { clone, newMap } from "../lib/mapModel";
import { editorWallBrush } from "./editorWallBrush";
function setup() {
  const source = newMap();
  const e = {
    draft: ref(source),
    catalogue: ref(catalogue),
    level: ref(0),
    previewTile: ref(null),
    selectedObject: ref(""),
    selectedObjects: ref([]),
    hoveredTile: ref(""),
    selection: ref(null),
    error: ref(""),
    pauseSave() {},
    setTileSelection() {},
    setObjectSelection(ids) {
      e.selectedObjects.value = ids;
      e.selectedObject.value = ids[0] || "";
    },
    history: [],
  };
  e.change = (fn) => {
    e.history.push(clone(e.draft.value));
    fn(e.draft.value);
  };
  return { e, brush: editorWallBrush(e) };
}
describe("automatic wall brush", () => {
  it("previews a connected corner and commits the stroke as one undo", () => {
    const { e, brush } = setup();
    brush.begin({ x: 2.5, y: 2.5 });
    brush.move({ x: 3.5, y: 2.5 });
    brush.move({ x: 3.5, y: 3.5 });
    expect(e.draft.value.document.tiles).toEqual([]);
    expect(e.previewTile.value.group).toHaveLength(3);
    expect(
      e.previewTile.value.group.find((t) => t.x === 3 && t.y === 2),
    ).toMatchObject({
      modelId: catalogue.find((m) => m.sourceCode === "LC-003").id,
      rotation: 270,
    });
    brush.end({ x: 3.5, y: 3.5 });
    expect(e.draft.value.document.tiles).toHaveLength(3);
    expect(e.history).toHaveLength(1);
    expect(e.previewTile.value).toBeNull();
  });
  it("bridges diagonal cursor motion and cancels without modifying the map", () => {
    const { e, brush } = setup();
    brush.begin({ x: 2.5, y: 2.5 });
    brush.move({ x: 4.5, y: 4.5 });
    expect(e.previewTile.value.group).toHaveLength(5);
    expect(
      e.previewTile.value.group.every((t) =>
        catalogue.find((m) => m.id === t.modelId).tileType.startsWith("wall-"),
      ),
    ).toBe(true);
    brush.cancel();
    expect(e.draft.value.document.tiles).toEqual([]);
    expect(e.history).toEqual([]);
  });
});
