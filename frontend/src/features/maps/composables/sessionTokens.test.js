import { expect, it, vi } from "vitest";
import { reactive, ref } from "vue";
import { sessionTokens } from "./sessionTokens";
function setup() {
  const actor = {
    kind: "player",
    ref: "41",
    name: "Лира",
    color: "#a797d4",
    hp: { current: 18, max: 24 },
  };
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
  expect(editor.history).toHaveLength(1);
  tokens.gesture({ phase: "cancel" }, editor);
  expect(editor.draft.state.tokens[0].x).toBe(1.5);
  expect(editor.history).toHaveLength(0);
  expect(tokens.surface.value).toBe(false);
});
