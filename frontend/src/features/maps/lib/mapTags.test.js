import { expect, it } from "vitest";
import { availableMapTags, matchesMapTags, normalizedMapTags } from "./mapTags";
const maps = [
  { name: "Башня", document: { tags: ["Лес", "подземелье"] } },
  { name: "Поляна", document: { tags: ["лес", "улица"] } },
];
it("normalizes whitespace and case duplicates while retaining the first spelling and limiting tag size", () => {
  expect(normalizedMapTags([" Лес ", "лес", "", "темная  пещера"])).toEqual([
    "Лес",
    "темная пещера",
  ]);
  expect(() => normalizedMapTags(["а".repeat(65)])).toThrow();
  expect(() =>
    normalizedMapTags(Array.from({ length: 33 }, (_, i) => `tag${i}`)),
  ).toThrow();
});
it("lists only distinct available tags and intersects selected tags with name or tag search", () => {
  expect(availableMapTags(maps)).toEqual(["Лес", "подземелье", "улица"]);
  expect(
    maps.filter((m) => matchesMapTags(m, "", ["лес", "подземелье"])),
  ).toEqual([maps[0]]);
  expect(maps.filter((m) => matchesMapTags(m, "УЛИЦ", []))).toEqual([maps[1]]);
  expect(maps.filter((m) => matchesMapTags(m, "башня", []))).toEqual([maps[0]]);
});
