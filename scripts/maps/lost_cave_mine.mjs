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
import { caveBonePartAt, paintCaveBones } from "./lost_cave_bones.mjs";
import { paintMineFlame } from "./lost_cave_torch.mjs";
export function mineProjectionAt(p, mine, ironMatch, woodMatch) {
  if (
    !mine.hardwareVolumes ||
    mine.hardwareVolumes.some((v) =>
      p.every((x, i) => x >= v.min[i] && x <= v.max[i]),
    )
  ) {
    const iron = ironMatch(p);
    if (iron) return iron;
  }
  return woodMatch(p);
}
export function minePartAt(p, n, spec, reference, projection) {
  const mine = spec.mine;
  if (mine.woodReference && !reference)
    throw new Error("Verified bare mine wall required for added boards");
  const projected = projection?.(p);
  const painted = scaffoldMemberAt(p, mine.grips || []);
  if (projected?.part === "grip" && painted) return { part: "grip" };
  if (painted && !mine.projectedGripsOnly)
    return { part: "grip", member: painted };
  const tool = scaffoldMemberAt(p, mine.ironMembers || []);
  if (tool) return { part: "iron" };
  if (
    projected?.part === "iron" &&
    (!mine.hardwareVolumes ||
      mine.hardwareVolumes.some((v) =>
        p.every((x, i) => x >= v.min[i] && x <= v.max[i]),
      )) &&
    (!mine.woodReference ||
      reference.distanceAt(p) > mine.woodReference.matchMM)
  )
    return { part: "iron" };
  if (scaffoldOrientedBoltAt(p, mine.bolts)) return { part: "iron" };
  const member = scaffoldMemberAt(p, mine.members);
  if (
    member &&
    (member.name !== "board" ||
      projected?.part === "wood" ||
      (reference.distanceAt(p) > mine.woodReference.matchMM &&
        !projection?.isVisible?.(p)))
  )
    return { part: "wood", member };
  return { part: p[2] > mine.stoneMinHeightMM ? "boulder" : "rock" };
}
export function paintCaveMine(p, n, ao, spec, reference, projection) {
  const flame = paintMineFlame(p, spec, projection);
  if (flame) return flame;
  if (spec.bones && caveBonePartAt(p, spec, reference, n) === "bone")
    return paintCaveBones(p, n, ao, spec, reference);
  const value = minePartAt(p, n, spec, reference, projection);
  if (value.part === "grip")
    return {
      part: "grip",
      rgb: spec.mine.gripTint.map((v) =>
        Math.round(
          255 * v * (0.85 + 0.15 * Math.max(0, Math.min(1, ao / 255))),
        ),
      ),
      roughness: 0.62,
      metallic: 0,
    };
  if (value.part === "wood")
    return finishScaffoldWood(p, n, ao, spec, value.member);
  if (value.part === "iron") {
    const iron = finishScaffoldIron(p, ao);
    if (spec.mine.ironTint)
      iron.rgb = iron.rgb.map((v, i) =>
        Math.round((v * spec.mine.ironTint[i]) / [0.48, 0.5, 0.48][i]),
      );
    return iron;
  }
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
