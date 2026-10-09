import { caveRockPixel, darkenCaveFloorJoints } from "./lost_cave_surface.mjs";
import { finishWood } from "./organic_finish.mjs";
import { scaffoldMemberCoordinates } from "./scaffold_member_geometry.mjs";
import { surfaceNoise } from "./surface_noise.mjs";
const clamp = (v) => Math.max(0, Math.min(1, v));
export function scaffoldBoltAt(p, n, spec) {
  return spec.scaffolding.bolts.find((b) => {
    const a = b.axis,
      u = 1 - a;
    const sign = Math.sign(b.centre[a]);
    return (
      p[a] * sign >= b.minOuterMM &&
      n[a] * sign > 0.2 &&
      Math.hypot(
        (p[u] - b.centre[u]) / b.radius[0],
        (p[2] - b.centre[2]) / b.radius[1],
      ) <= 1
    );
  });
}
export function scaffoldBeamAt(p, spec) {
  const s = spec.scaffolding;
  if (Math.max(Math.abs(p[0]), Math.abs(p[1])) < s.innerHalfMM - 0.18)
    return undefined;
  if (Math.min(Math.abs(p[0]), Math.abs(p[1])) >= s.postInnerMM)
    return {
      axis: "z",
      centre: [
        Math.sign(p[0]) * s.postCentreMM,
        Math.sign(p[1]) * s.postCentreMM,
        17,
      ],
    };
  const long = Math.abs(p[1]) > Math.abs(p[0]) ? 0 : 1;
  const across = 1 - long;
  const side = Math.sign(p[across]) * s.sideCentreMM;
  const centre = [0, 0, 0];
  centre[across] = side;
  const d = s.braces;
  if (
    p[2] > s.baseTopMM &&
    p[2] < d.topMM &&
    Math.abs(p[2] - (d.apexZMM - Math.abs(p[long]) * d.slope)) /
      Math.hypot(1, d.slope) <=
      d.halfWidthMM
  ) {
    centre[long] = Math.sign(p[long]) * 6.5;
    centre[2] = d.apexZMM - 6.5 * d.slope;
    return {
      axis: long === 0 ? "x" : "y",
      centre,
      long,
      across,
      slope: -Math.sign(p[long] || 1) * d.slope,
    };
  }
  centre[2] =
    p[2] <= s.baseTopMM
      ? s.baseTopMM - 0.6
      : s.panelBands
          .find(([lo, hi]) => p[2] >= lo && p[2] <= hi)
          ?.reduce((a, b) => a + b) / 2 || 28;
  return { axis: long === 0 ? "x" : "y", centre };
}
export function scaffoldInnerAt(p, n, spec) {
  const s = spec.scaffolding;
  return (
    Math.abs(Math.max(Math.abs(p[0]), Math.abs(p[1])) - s.innerHalfMM) < 0.2 &&
    p[2] >= s.liningMinZMM &&
    p[0] * n[0] + p[1] * n[1] < 0
  );
}
export function finishScaffoldIron(p, ao) {
  const detail = 0.78 + 0.22 * clamp((ao / 255 - 0.65) / 0.35);
  const rust = clamp((surfaceNoise(...p.map((v) => v * 0.7)) - 0.62) * 1.3);
  return {
    part: "iron",
    rgb: [0.48, 0.5, 0.48].map((v, i) =>
      Math.round(255 * detail * (v * (1 - rust) + [0.36, 0.2, 0.1][i] * rust)),
    ),
    roughness: 0.58 + rust * 0.25,
    metallic: 0.72 * (1 - rust * 0.6),
  };
}
export function finishScaffoldWood(p, n, ao, spec, beam) {
  const detail = 0.78 + 0.22 * clamp((ao / 255 - 0.65) / 0.35);
  const age = 0.96 + 0.08 * surfaceNoise(...beam.centre.map((v) => v * 0.21));
  const tint = (
    beam.axis === "z"
      ? spec.scaffolding.postTint || spec.scaffolding.woodTint
      : spec.scaffolding.woodTint
  ).map((v) => v * age);
  let value;
  if (beam.direction) {
    const local = scaffoldMemberCoordinates(p, n, beam);
    value = finishWood(detail, local.p, local.n, "x", [0, 0, 0], tint);
  } else if (beam.slope !== undefined) {
    const length = Math.hypot(1, beam.slope),
      c = 1 / length,
      s = beam.slope / length;
    const u = p[beam.long] - beam.centre[beam.long],
      z = p[2] - beam.centre[2];
    value = finishWood(
      detail,
      [
        u * c + z * s,
        p[beam.across] - beam.centre[beam.across],
        -u * s + z * c,
      ],
      [
        n[beam.long] * c + n[2] * s,
        n[beam.across],
        -n[beam.long] * s + n[2] * c,
      ],
      "x",
      [0, 0, 0],
      tint,
    );
  } else value = finishWood(detail, p, n, beam.axis, beam.centre, tint);
  return value;
}
export function paintScaffolding(p, n, ao, spec) {
  if (scaffoldBoltAt(p, n, spec)) return finishScaffoldIron(p, ao);
  const beam = scaffoldBeamAt(p, spec);
  if (!beam)
    return darkenCaveFloorJoints(caveRockPixel(p, n, ao, spec), p, spec);
  const value = finishScaffoldWood(p, n, ao, spec, beam);
  value.normalNeutral =
    spec.scaffolding.liningGeometryNormals && scaffoldInnerAt(p, n, spec);
  return value;
}
