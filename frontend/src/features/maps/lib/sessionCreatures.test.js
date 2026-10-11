import { expect, it } from "vitest";
import { creaturePortraitUrl, withCreaturePortraits } from "./sessionCreatures";

it("uses raster artwork first and a persistent SVG URL for SVG-only creatures", () => {
  expect(
    creaturePortraitUrl({ iconImageUrl: "/art/ogre.webp", iconSvgId: 12 }),
  ).toBe("/art/ogre.webp");
  expect(
    creaturePortraitUrl({ iconSvgId: 12, svg: '<svg viewBox="0 0 24 24" />' }),
  ).toBe("/api/svg/12");
  expect(creaturePortraitUrl(null)).toBe("");
});
it("fills missing portraits by identity while preserving saved snapshots and map state", () => {
  const tokens = [
    { id: "ogre", kind: "creature", ref: "ogre", imageUrl: "" },
    { id: "hero", kind: "player", ref: "41", imageUrl: "/art/saved.webp" },
    { id: "marker", kind: "marker", ref: "", imageUrl: "" },
  ];
  const result = withCreaturePortraits(tokens, [
    { kind: "creature", ref: "ogre", previewUrl: "/api/svg/12" },
    { kind: "player", ref: "41", previewUrl: "/art/new.webp" },
  ]);
  expect(result[0].imageUrl).toBe("/api/svg/12");
  expect(tokens[0].imageUrl).toBe("");
  expect(result[1]).toBe(tokens[1]);
  expect(result[2]).toBe(tokens[2]);
});
