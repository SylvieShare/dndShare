import { it, expect } from "vitest";
import { ref } from "vue";
import { editorTransitions } from "./editorTransitions";
import { newMap, clone } from "../lib/mapModel";
it("keeps the replacement and removal of attached lights in one undo checkpoint", () => {
  const edge = { id: "edge", action: "open", toDefinitionId: "open" };
  const closed = {
    id: "closed",
    width: 1,
    height: 1,
    tileType: "passage",
    behaviour: { transitions: [edge] },
  };
  const open = {
    ...closed,
    id: "open",
    definitionId: "open",
    sourceCode: "open",
  };
  const draft = ref(newMap()),
    history = [];
  draft.value.document.tiles = [
    { id: "door", modelId: "closed", x: 2, y: 2, level: 0, rotation: 0 },
  ];
  draft.value.document.lights = [
    { id: "lamp", anchor: { kind: "tile", id: "door" } },
  ];
  const original = clone(draft.value),
    e = {
      draft,
      catalogue: ref([closed, open]),
      error: ref(""),
      change(fn) {
        history.push(clone(draft.value));
        fn(draft.value);
      },
    };
  editorTransitions(e).applyTransition("tile", "door", edge);
  expect(history).toHaveLength(1);
  expect(draft.value.document.tiles[0].modelId).toBe("open");
  expect(draft.value.document.lights).toEqual([]);
  draft.value = history.pop();
  expect(draft.value).toEqual(original);
});
