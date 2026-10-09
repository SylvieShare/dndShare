import {
  scaffoldMemberAt,
  scaffoldOrientedBoltAt,
} from "./scaffold_member_geometry.mjs";
import {
  finishScaffoldIron,
  finishScaffoldWood,
} from "./lost_cave_scaffolding.mjs";
import { caveRockPixel, darkenCaveFloorJoints } from "./lost_cave_surface.mjs";
import { paintBoulder } from "./lost_cave_boulder.mjs";
export function minePartAt(p, n, spec) {
  const mine = spec.mine;
  if (scaffoldOrientedBoltAt(p, mine.bolts)) return { part: "iron" };
  const member = scaffoldMemberAt(p, mine.members);
  if (member) return { part: "wood", member };
  return { part: p[2] > mine.stoneMinHeightMM ? "boulder" : "rock" };
}
export function paintCaveMine(p, n, ao, spec) {
  const value = minePartAt(p, n, spec);
  if (value.part === "wood")
    return finishScaffoldWood(p, n, ao, spec, value.member);
  if (value.part === "iron") return finishScaffoldIron(p, ao);
  if (value.part === "boulder") {
    const stone = paintBoulder(p, n, ao, spec);
    const floor = darkenCaveFloorJoints(caveRockPixel(p, n, ao, spec), p, spec);
    const t = Math.max(
      0,
      Math.min(1, (p[2] - spec.mine.stoneMinHeightMM) / 1.2),
    );
    const weight = t * t * (3 - 2 * t);
    stone.rgb = stone.rgb.map((v, i) =>
      Math.round(v * weight + floor.rgb[i] * (1 - weight)),
    );
    return stone;
  }
  return darkenCaveFloorJoints(caveRockPixel(p, n, ao, spec), p, spec);
}
