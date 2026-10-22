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
    pauseSave: vi.fn(),
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
it("holds and drags without saving intermediate positions, preserving the grab point and one undo", () => {
  const { e, journal, decals } = fixture();
  decals.beginDecal(image);
  decals.handle({ phase: "start", point });
  decals.handle({ phase: "end", point });
  const source = e.draft.value.document.decals[0],
    id = source.id;
  const grab = {
    decalSurface: { ...point.decalSurface, position: [0.2, 1, 0.1] },
  };
  const target = {
    decalSurface: { ...point.decalSurface, position: [0.7, 1.4, 0.4] },
  };
  decals.handle({
    phase: "start",
    point: grab,
    hit: { decalId: id },
    event: { clientX: 20, clientY: 30 },
  });
  decals.handle({ phase: "hold", point: grab });
  expect(e.pauseSave).toHaveBeenLastCalledWith(true);
  decals.handle({
    phase: "move",
    point: target,
    event: { clientX: 70, clientY: 60 },
  });
  expect(source.position).toEqual([0, 1, 0]);
  expect(decals.previewDecal.value.position[0]).toBeCloseTo(0.5);
  expect(decals.previewDecal.value.position[1]).toBe(1);
  expect(decals.previewDecal.value.position[2]).toBeCloseTo(0.3);
  decals.handle({ phase: "end", point: target });
  expect(journal.history.value).toHaveLength(2);
  expect(source.position[0]).toBeCloseTo(0.5);
  expect(e.pauseSave).toHaveBeenLastCalledWith(false);
  journal.undo();
  expect(e.draft.value.document.decals[0].position).toEqual([0, 1, 0]);
});
it("restores a held decal on cancellation and deleting from the owner keeps that focus", () => {
  const { e, journal, decals } = fixture();
  decals.beginDecal(image);
  decals.handle({ phase: "start", point });
  decals.handle({ phase: "end", point });
  const item = e.draft.value.document.decals[0];
  decals.handle({
    phase: "start",
    point,
    hit: { decalId: item.id },
    event: { clientX: 20, clientY: 20 },
  });
  decals.handle({ phase: "hold", point });
  decals.handle({
    phase: "move",
    point: { decalSurface: { ...point.decalSurface, position: [1, 1, 1] } },
    event: { clientX: 80, clientY: 80 },
  });
  decals.handle({ phase: "cancel" });
  expect(item.position).toEqual([0, 1, 0]);
  expect(decals.previewDecal.value).toBeNull();
  expect(journal.history.value).toHaveLength(1);
  decals.selectedDecal.value = "";
  e.setTileSelection.mockClear();
  decals.remove(item.id);
  expect(e.setTileSelection).not.toHaveBeenCalled();
  expect(e.draft.value.document.decals).toBeUndefined();
});
