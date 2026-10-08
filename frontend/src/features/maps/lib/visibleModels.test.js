import { expect, it } from "vitest";
import { visibleModels } from "./visibleModels";
it("keeps distinct source variants and omits retired models", () => {
  const a = { id: "angle", sourceCode: "UD-055", sourceName: "Angle" },
    b = { id: "wall", sourceCode: "UD-055", sourceName: "Wall" },
    c = { id: "retired", hidden: true };
  expect(visibleModels([a, b, c])).toEqual([a, b]);
});
