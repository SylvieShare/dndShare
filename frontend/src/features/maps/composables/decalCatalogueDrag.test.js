import { expect, it, vi } from "vitest";
import { ref } from "vue";
import { useEditorJournal } from "./useEditorJournal";
import { editorDecals } from "./editorDecals";
import { decalCatalogueDrag } from "./decalCatalogueDrag";

it("catalogue drag creates one undoable decal only on a valid drop and leaves it focused", () => {
  const draft = ref({ document: { tiles: [{ id: "floor" }], objects: [] } }),
    journal = useEditorJournal(draft, true);
  const core = {
    draft,
    tool: ref("select"),
    selectedLight: ref(""),
    selection: ref(null),
    setTileSelection: vi.fn(),
    setObjectSelection: vi.fn(),
    pauseSave: vi.fn(),
    checkpoint: journal.checkpoint,
    commitEdit: journal.commit,
    change(fn) {
      journal.checkpoint();
      fn(draft.value);
      journal.commit();
    },
  };
  const decals = editorDecals(core),
    driver = decalCatalogueDrag({
      beginDecal: decals.beginDecal,
      handle: decals.handle,
      pauseSave: core.pauseSave,
    });
  const image = {
    name: "Лужа",
    category: "traces",
    imageUrl: "/images/maps/decals/blood-pool.svg",
  };
  const point = {
    decalSurface: {
      anchor: { kind: "tile", id: "floor" },
      position: [0, 0.4, 0],
      normal: [0, 1, 0],
    },
  };
  driver.begin(image);
  driver.move(point);
  expect(draft.value.document.decals).toBeUndefined();
  expect(journal.history.value).toHaveLength(0);
  driver.drop(null);
  expect(draft.value.document.decals).toBeUndefined();
  expect(core.tool.value).toBe("select");
  driver.begin(image);
  driver.move(point);
  driver.drop(point);
  driver.drop(point);
  expect(draft.value.document.decals).toHaveLength(1);
  expect(journal.history.value).toHaveLength(1);
  expect(decals.selectedDecal.value).toBe(draft.value.document.decals[0].id);
  expect(core.pauseSave).toHaveBeenLastCalledWith(false);
  journal.undo();
  expect(draft.value.document.decals).toBeUndefined();
});
