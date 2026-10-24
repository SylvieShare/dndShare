import { expect, it, vi } from "vitest";
import { nextTick, reactive, ref } from "vue";
import { sessionTokens } from "./sessionTokens";
function setup() {
  const actor = reactive({
    kind: "player",
    ref: "41",
    name: "Лира",
    color: "#a797d4",
    hp: { current: 18, max: 24 },
  });
  const editor = reactive({
    draft: { document: { tiles: [] }, state: { tokens: [] } },
    history: [],
    future: [],
    clearAreaFocus: vi.fn(),
    setTileSelection: vi.fn(),
    setObjectSelection: vi.fn(),
    pauseSave: vi.fn(),
    resetGesture: vi.fn(),
    change(fn) {
      this.history.push(
        structuredClone(JSON.parse(JSON.stringify(this.draft))),
      );
      fn(this.draft);
    },
  });
  const tokens = sessionTokens(
    () => editor,
    ref([actor]),
    () => null,
  );
  return { actor, editor, tokens };
}
it("keeps creature rotation and reflection during placement, movement and cancellation", () => {
  const { actor, editor, tokens } = setup();
  Object.assign(actor, { kind: "creature", itemId: 1635 });
  const point = { x: 2.5, y: 3.5, grid: true };
  tokens.place(actor);
  expect(tokens.rotate()).toBe(true);
  expect(tokens.mirror()).toBe(true);
  tokens.gesture({ phase: "hover", point }, editor);
  expect(tokens.canvasState.value.tokens[0]).toMatchObject({ rotation: 90, mirrored: true });
  expect(editor.draft.state.tokens).toHaveLength(0);
  tokens.gesture({ phase: "start", point }, editor);
  const stored = editor.draft.state.tokens[0];
  expect(stored).toMatchObject({ rotation: 90, mirrored: true });
  tokens.gesture({ phase: "start", hit: { tokenId: stored.id } }, editor);
  tokens.rotate();
  tokens.mirror();
  tokens.gesture({ phase: "move", point: { ...point, x: 5 } }, editor);
  expect(tokens.canvasState.value.tokens[0]).toMatchObject({ rotation: 180, mirrored: false, x: 5 });
  tokens.gesture({ phase: "cancel" }, editor);
  expect(stored).toMatchObject({ rotation: 90, mirrored: true, x: 2.5 });
  tokens.place(actor);
  tokens.gesture({ phase: "start", point: { ...point, x: 4 } }, editor);
  expect(editor.draft.state.tokens[0]).toMatchObject({ rotation: 90, mirrored: true, x: 4 });
});
it("tracks token hover and leaves player transformations to the editor", () => {
  const { actor, editor, tokens } = setup();
  tokens.focus(actor, false);
  expect(tokens.rotate()).toBe(false);
  expect(tokens.mirror()).toBe(false);
  tokens.gesture({ phase: "hover", hit: { tokenId: "hero" } }, editor);
  expect(tokens.hovered.value).toBe("hero");
  tokens.gesture({ phase: "hover", hit: null }, editor);
  expect(tokens.hovered.value).toBe("");
});
it("preview and cancelled placement do not enter durable play state or copy HP into a token", () => {
  const { actor, editor, tokens } = setup();
  tokens.place(actor);
  const point = { x: 2.5, y: 3.5, placement: { tileId: "base", point: 0 } };
  tokens.gesture({ phase: "hover", point }, editor);
  expect(tokens.canvasState.value.tokens).toHaveLength(1);
  expect(editor.draft.state.tokens).toHaveLength(0);
  tokens.gesture({ phase: "cancel" }, editor);
  expect(tokens.canvasState.value.tokens).toHaveLength(0);
  tokens.place(actor);
  tokens.gesture({ phase: "start", point }, editor);
  expect(editor.draft.state.tokens[0]).toMatchObject({
    kind: "player",
    ref: "41",
    x: 2.5,
    y: 3.5,
  });
  expect(editor.draft.state.tokens[0]).not.toHaveProperty("hp");
});
it("held-token motion is one undoable change and cancellation restores position", () => {
  const { actor, editor, tokens } = setup();
  editor.draft.state.tokens.push({ ...actor, id: "hero", x: 1.5, y: 1.5 });
  tokens.gesture({ phase: "start", hit: { tokenId: "hero" } }, editor);
  expect(tokens.surface.value).toBe(true);
  tokens.gesture(
    {
      phase: "move",
      point: { x: 4.5, y: 4.5, placement: { tileId: "base", point: 0 } },
    },
    editor,
  );
  tokens.gesture(
    {
      phase: "move",
      point: { x: 5.5, y: 4.5, placement: { tileId: "base", point: 0 } },
    },
    editor,
  );
  expect(editor.history).toHaveLength(0);
  expect(editor.draft.state.tokens[0].x).toBe(1.5);
  expect(tokens.canvasState.value.tokens[0].x).toBe(5.5);
  tokens.gesture({ phase: "cancel" }, editor);
  expect(editor.draft.state.tokens[0].x).toBe(1.5);
  expect(editor.history).toHaveLength(0);
  expect(tokens.surface.value).toBe(false);
});

it("late creature artwork reaches existing and pending tokens without changing the stored map", () => {
  const { actor, editor, tokens } = setup();
  editor.draft.state.tokens.push({
    ...actor,
    id: "hero",
    imageUrl: "",
    x: 1.5,
    y: 1.5,
  });
  tokens.place(actor);
  tokens.gesture(
    {
      phase: "hover",
      point: { x: 2.5, y: 3.5, placement: { tileId: "base", point: 0 } },
    },
    editor,
  );
  expect(tokens.canvasState.value.tokens.every((t) => !t.imageUrl)).toBe(true);
  // The cached creature/participant data may arrive after the map and placement preview.
  Object.assign(actor, { previewUrl: "/art/hero.webp" });
  expect(
    tokens.canvasState.value.tokens.every(
      (t) => t.imageUrl === "/art/hero.webp",
    ),
  ).toBe(true);
  expect(editor.draft.state.tokens[0].imageUrl).toBe("");
  tokens.gesture(
    {
      phase: "start",
      point: { x: 2.5, y: 3.5, placement: { tileId: "base", point: 0 } },
    },
    editor,
  );
  expect(editor.draft.state.tokens[0].imageUrl).toBe("/art/hero.webp");
});

it("moving a roster creature reuses its ID and settings, previews only one token and commits once", () => {
  const { actor, editor, tokens } = setup();
  editor.draft.state.tokens.push({
    kind: actor.kind,
    ref: actor.ref,
    name: actor.name,
    id: "hero",
    x: 1.5,
    y: 1.5,
    size: 2,
    hidden: true,
    physical: true,
  });
  tokens.place(actor);
  const point = { x: 4.5, y: 5.5, placement: { tileId: "base", point: 1 } };
  tokens.gesture({ phase: "hover", point }, editor);
  expect(tokens.canvasState.value.tokens).toHaveLength(1);
  expect(tokens.canvasState.value.tokens[0]).toMatchObject({
    id: "hero",
    x: 4.5,
    size: 2,
    hidden: true,
    physical: true,
  });
  expect(editor.draft.state.tokens[0].x).toBe(1.5);
  tokens.gesture({ phase: "start", point }, editor);
  expect(editor.history).toHaveLength(1);
  expect(editor.draft.state.tokens).toHaveLength(1);
  expect(editor.draft.state.tokens[0]).toMatchObject({
    id: "hero",
    x: 4.5,
    y: 5.5,
    size: 2,
    hidden: true,
    physical: true,
  });
});
it("focuses a creature with the shared smooth camera controller after opening its inspector", async () => {
  const e = {
    draft: {
      document: { tiles: [] },
      state: {
        tokens: [
          {
            id: "hero",
            kind: "player",
            ref: "41",
            x: 2.5,
            y: 3.5,
            elevation: 4,
          },
        ],
      },
    },
    catalogue: [],
    resetGesture() {},
    clearAreaFocus() {},
    setTileSelection() {},
    setObjectSelection() {},
  };
  const canvas = { focusAt: vi.fn(), focus: vi.fn() };
  const actor = { kind: "player", ref: "41", name: "Лира" };
  const c = sessionTokens(
    () => e,
    ref([actor]),
    () => canvas,
  );
  c.focus(actor);
  expect(canvas.focusAt).not.toHaveBeenCalled();
  await nextTick();
  expect(canvas.focusAt).toHaveBeenCalledWith(
    expect.objectContaining({ x: 2.5, y: 3.5, elevation: 4 }),
  );
  canvas.focusAt.mockClear();
  c.place(actor);
  await nextTick();
  expect(canvas.focusAt).not.toHaveBeenCalled();
});
