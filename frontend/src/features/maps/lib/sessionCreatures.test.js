import { expect, it } from "vitest";
import {
  creatureFootprint,
  creaturePortraitUrl,
  sessionCreatures,
  withCreaturePortraits,
  withCreatureLifeState,
} from "./sessionCreatures";

it("resolves a creature's footprint by size code rather than numeric suggestion order", () => {
  const sizes = [
    { id: 91, code: "tiny" },
    { id: 7, code: "large" },
    { id: 2, code: "huge" },
    { id: 1, code: "gargantuan" },
  ];
  const item = (ids) => ({ data: { identity: { size: ids } } });
  expect(creatureFootprint(item([7]), sizes)).toBe(2);
  expect(creatureFootprint(item([91]), sizes)).toBe(0.5);
  expect(creatureFootprint(item([2, 7]), sizes)).toBe(3);
  expect(creatureFootprint(item([1]), sizes)).toBe(4);
  expect(creatureFootprint(item([404]), sizes)).toBe(1);
  expect(creatureFootprint(null, sizes)).toBe(1);
  const encounter = {
    encounter: { combatants: [{ type: "npc", uid: "owlbear", itemId: 2579 }] },
    npcName: () => "Совомед",
    npcItem: () => item([7]),
  };
  expect(sessionCreatures([], encounter, sizes)[0]).toMatchObject({
    itemId: 2579,
    size: 2,
  });
});

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

it("projects graveyard membership without persisting it and removes it after revival", () => {
  const tokens = [
    { kind: "creature", ref: "ogre" },
    { kind: "player", ref: "41" },
  ];
  const candidates = [
    { kind: "creature", ref: "ogre", dead: true },
    { kind: "player", ref: "41", dead: false },
  ];
  expect(withCreatureLifeState(tokens, candidates).map((t) => t.dead)).toEqual([
    true,
    false,
  ]);
  expect(tokens[0]).not.toHaveProperty("dead");
  candidates[0].dead = false;
  expect(withCreatureLifeState(tokens, candidates)[0].dead).toBe(false);
});
