import { expect, it } from "vitest";
import { modelMetadata } from "./modelMetadata";
it("copies editable metadata deeply, preserves identity and excludes URLs and assets", () => {
  const source = {
    id: "one",
    version: 2,
    textureDetail: "detailed",
    tileType: "wall-straight",
    width: 1,
    height: 1,
    tags: ["stone"],
    supportSlots: [{ x: 0, y: 0 }],
    assets: { source: "private" },
    renderUrl: "/render",
  };
  const draft = modelMetadata(source);
  expect(draft.wallMask).toBe(17);
  expect(draft.id).toBe("one");
  expect(draft.version).toBe(2);
  expect(draft.textureDetail).toBe("detailed");
  expect(draft.assets).toBeUndefined();
  expect(draft.renderUrl).toBeUndefined();
  draft.supportSlots[0].x = 2;
  draft.tags.push("new");
  expect(source.supportSlots[0].x).toBe(0);
  expect(source.tags).toEqual(["stone"]);
});
