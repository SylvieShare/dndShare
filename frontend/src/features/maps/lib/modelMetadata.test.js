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
    mountProfile: "xl-ring",
    tags: ["stone"],
    supportSlots: [{ x: 0, y: 0, insertionRises: { "xl-ring": .08 } }],
    assets: { source: "private" },
    renderUrl: "/render",
  };
  const draft = modelMetadata(source);
  expect(draft.wallMask).toBe(17);
  expect(draft.id).toBe("one");
  expect(draft).not.toHaveProperty("version");
  expect(draft.textureDetail).toBe("detailed");
  expect(draft.mountProfile).toBe("xl-ring");
  expect(draft.assets).toBeUndefined();
  expect(draft.renderUrl).toBeUndefined();
  draft.supportSlots[0].x = 2;
  draft.supportSlots[0].insertionRises["xl-ring"] = .1;
  draft.tags.push("new");
  expect(source.supportSlots[0].x).toBe(0);
  expect(source.supportSlots[0].insertionRises["xl-ring"]).toBe(.08);
  expect(source.tags).toEqual(["stone"]);
});
