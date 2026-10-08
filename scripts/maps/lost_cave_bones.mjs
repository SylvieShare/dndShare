import { finishBone } from "./bone_finish.mjs";
import { caveRockPixel, darkenCaveFloorJoints } from "./lost_cave_surface.mjs";
import { surfaceNoise } from "./surface_noise.mjs";

function inPolygon([x, y], polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [ax, ay] = polygon[i],
      [bx, by] = polygon[j];
    if (ay > y !== by > y && x < ((bx - ax) * (y - ay)) / (by - ay) + ax)
      inside = !inside;
  }
  return inside;
}
function nearPath(p, path) {
  return path.points.slice(1).some((b, i) => {
    const a = path.points[i],
      dx = b[0] - a[0],
      dy = b[1] - a[1];
    const t = Math.max(
      0,
      Math.min(
        1,
        ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy),
      ),
    );
    return (
      Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy) <= path.radius
    );
  });
}
export function caveBonePartAt(p, spec, reference) {
  if (!reference)
    throw new Error("Verified bare source required for cave bones");
  if (p[2] < spec.bones.minZ) return "rock";
  if (
    spec.bones.volumes?.some(
      (v) =>
        p.reduce(
          (sum, n, i) => sum + ((n - v.centre[i]) / v.radius[i]) ** 2,
          0,
        ) < 1,
    ) ||
    spec.bones.paths?.some((path) => nearPath(p, path)) ||
    spec.bones.directRegions?.some((poly) => inPolygon(p, poly))
  )
    return "bone";
  if (
    spec.bones.regions &&
    !spec.bones.regions.some((poly) => inPolygon(p, poly))
  )
    return "rock";
  const sample = p.map((v, i) => v + (spec.bones.referenceOffsetMM?.[i] ?? 0));
  return reference.distanceAt(sample) > spec.bones.matchMM ? "bone" : "rock";
}

export function paintCaveBones(p, n, ao, spec, reference) {
  if (caveBonePartAt(p, spec, reference) === "rock")
    return darkenCaveFloorJoints(caveRockPixel(p, n, ao, spec), p, spec);
  const detail = 0.9 + 0.1 * Math.min(1, ao / 255);
  const value = finishBone(detail, p, ao, spec.bones.groups);
  const pore = surfaceNoise(...p.map((v) => v * 2.2));
  const age = surfaceNoise(...p.map((v) => v * 0.28));
  const speckle = Math.max(0, (pore - 0.62) / 0.38) * (0.25 + age * 0.2);
  value.rgb = value.rgb.map((v) => Math.round(v * (1 - speckle)));
  return value;
}
