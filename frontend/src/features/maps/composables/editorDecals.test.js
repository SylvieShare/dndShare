import { expect, it, vi } from "vitest";
import { ref } from "vue";
import { editorDecals } from "./editorDecals";
import { useEditorJournal } from "./useEditorJournal";
import { copiedDecals, pruneDecals } from "../lib/mapDecals";

function fixture() {
  const draft = ref({ document: { tiles: [{ id: "tile" }], objects: [] } }),
    journal = useEditorJournal(draft, true);
  const e = {
    draft,
    tool: ref("select"),
    selectedLight: ref(""),
    selection: ref(null),
    setTileSelection: vi.fn(),
    setObjectSelection: vi.fn(),
    checkpoint: journal.checkpoint,
    commitEdit: journal.commit,
    change(fn) {
      journal.checkpoint();
      fn(draft.value);
      pruneDecals(draft.value.document);
      journal.commit();
    },
  };
  return { e, journal, decals: editorDecals(e) };
}
const image = {
  name: "Кровь",
  category: "traces",
  imageUrl: "/images/maps/decals/blood-pool.svg",
};
const point = {
  decalSurface: {
    anchor: { kind: "tile", id: "tile" },
    position: [0, 1, 0],
    normal: [0, 1, 0],
  },
};
it("places, edits and removes through reversible document patches", () => {
  const { e, journal, decals } = fixture();
  expect(e.draft.value.document.decals).toBeUndefined();
  decals.beginDecal(image);
  decals.handle({ phase: "hover", point });
  expect(decals.previewDecal.value.name).toBe(image.name);
  decals.handle({ phase: "start", point });
  decals.handle({ phase: "end", point });
  const id = decals.selectedDecal.value;
  expect(e.draft.value.document.decals[0].anchor.id).toBe("tile");
  decals.updateDecal("opacity", 0.7);
  decals.updateDecal("opacity", 0.5);
  decals.finishDecalEdit();
  expect(journal.history.value).toHaveLength(2);
  journal.undo();
  expect(e.draft.value.document.decals[0].opacity).toBe(1);
  journal.redo();
  expect(e.draft.value.document.decals[0].opacity).toBe(0.5);
  expect(decals.copy()).toBe(true);
  expect(decals.copiedDecal.value.id).toBe(id);
  decals.remove();
  expect(e.draft.value.document.decals).toBeUndefined();
  journal.undo();
  expect(e.draft.value.document.decals[0].id).toBe(id);
});
it("copies attachments to new stable owners and prunes only missing owners", () => {
  const { e, decals } = fixture();
  decals.beginDecal(image);
  decals.handle({ phase: "start", point });
  const source = e.draft.value.document.decals;
  const copied = copiedDecals(source, new Map([["tile:tile", "new-tile"]]));
  expect(copied[0].anchor.id).toBe("new-tile");
  expect(copied[0].id).not.toBe(source[0].id);
  const d = { tiles: [], objects: [], decals: source };
  pruneDecals(d);
  expect(d.decals).toBeUndefined();
});
it("cancels relocation without changing the saved decal", () => {
  const { e, decals } = fixture();
  decals.beginDecal(image);
  decals.handle({ phase: "start", point });
  decals.handle({ phase: "end", point });
  const original = JSON.stringify(e.draft.value.document.decals);
  decals.moveDecal(e.draft.value.document.decals[0]);
  decals.handle({
    phase: "hover",
    point: {
      ...point,
      decalSurface: { ...point.decalSurface, position: [2, 1, 0] },
    },
  });
  decals.handle({ phase: "cancel" });
  expect(JSON.stringify(e.draft.value.document.decals)).toBe(original);
});
