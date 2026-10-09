import { caveRockPixel, darkenCaveFloorJoints } from "./lost_cave_surface.mjs";
import {
  finishScaffoldIron,
  finishScaffoldWood,
} from "./lost_cave_scaffolding.mjs";
import {
  scaffoldMemberAt,
  scaffoldOrientedBoltAt,
} from "./scaffold_member_geometry.mjs";
export function scaffoldRampPartAt(p, n, spec) {
  const r = spec.scaffolding.ramp;
  if (scaffoldOrientedBoltAt(p, r.bolts)) return { part: "iron" };
  const floor = r.floorDeck;
  if (
    p[2] >= floor.minZMM &&
    p[2] <= floor.maxZMM &&
    Math.max(Math.abs(p[0]), Math.abs(p[1])) <= floor.halfMM
  )
    return { part: "wood", member: floor };
  const side = r.members.find(
    (m) =>
      m.name === "base-side" &&
      Math.abs(p[1] - m.centre[1]) < m.halfWidth &&
      Math.abs(p[1]) > 16 &&
      p[2] < 15.6,
  );
  if (side) return { part: "wood", member: side };
  const member = scaffoldMemberAt(p, r.members);
  return member ? { part: "wood", member } : { part: "rock" };
}
export function paintScaffoldingRamp(p, n, ao, spec) {
  const value = scaffoldRampPartAt(p, n, spec);
  if (value.part === "iron") return finishScaffoldIron(p, ao);
  if (value.part === "wood")
    return finishScaffoldWood(p, n, ao, spec, value.member);
  return darkenCaveFloorJoints(caveRockPixel(p, n, ao, spec), p, spec);
}
