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
function polygonDistance(p, polygon) {
  return Math.min(
    ...polygon.map((a, i) => {
      const b = polygon[(i + 1) % polygon.length],
        dx = b[0] - a[0],
        dy = b[1] - a[1];
      const den = dx * dx + dy * dy;
      const t = den
        ? Math.max(
            0,
            Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / den),
          )
        : 0;
      return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
    }),
  );
}
function caveBoneWeight(p, spec, reference, normal) {
  if (!reference && !spec.bones.regionsOnly)
    throw new Error(
      "Verified bare source or individually measured bone regions required",
    );
  if (reference?.projectedBoneAt?.(p)) return 1;
  if (
    p[2] < spec.bones.minZ ||
    (spec.bones.maxZ !== undefined && p[2] > spec.bones.maxZ)
  )
    return 0;
  const sample = p.map((v, i) => v + (spec.bones.referenceOffsetMM?.[i] ?? 0));
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
    return 1;
  if (
    spec.bones.regionPaddingMM &&
    normal &&
    (normal[2] < spec.bones.paddingNormalMaxZ ||
      p[2] > spec.floorHeightMM + 0.15)
  ) {
    const distance = Math.min(
      ...spec.bones.directRegions.map((poly) => polygonDistance(p, poly)),
    );
    const sourceDistance = spec.bones.paddingMatchMM
      ? (reference?.distanceAt(sample) ?? 0)
      : Infinity;
    if (
      distance < spec.bones.regionPaddingMM &&
      sourceDistance > (spec.bones.paddingMatchMM ?? 0)
    ) {
      const edge = 1 - distance / spec.bones.regionPaddingMM;
      const source = spec.bones.paddingMatchMM
        ? Math.max(
            0,
            Math.min(1, (sourceDistance - spec.bones.paddingMatchMM) / 0.5),
          )
        : 1;
      return spec.bones.softPadding ? edge * source * 0.75 : 1;
    }
  }

  if (spec.bones.regionsOnly) return 0;
  if (
    spec.bones.regions &&
    !spec.bones.regions.some((poly) => inPolygon(p, poly))
  )
    return 0;
  return reference.distanceAt(sample) > spec.bones.matchMM ? 1 : 0;
}

export function caveBonePartAt(p, spec, reference, normal) {
  return caveBoneWeight(p, spec, reference, normal) > 0 ? "bone" : "rock";
}
export function paintCaveBones(p, n, ao, spec, reference) {
  const weight = caveBoneWeight(p, spec, reference, n);
  if (!weight)
    return darkenCaveFloorJoints(caveRockPixel(p, n, ao, spec), p, spec);
  const detail = 0.9 + 0.1 * Math.min(1, ao / 255);
  const value = finishBone(detail, p, ao, spec.bones.groups);
  const pore = surfaceNoise(...p.map((v) => v * 2.2));
  const age = surfaceNoise(...p.map((v) => v * 0.28));
  const speckle = Math.max(0, (pore - 0.62) / 0.38) * (0.25 + age * 0.2);
  value.rgb = value.rgb.map((v) => Math.round(v * (1 - speckle)));
  if (weight < 1) {
    const stone = darkenCaveFloorJoints(caveRockPixel(p, n, ao, spec), p, spec);
    value.rgb = value.rgb.map((v, i) =>
      Math.round(v * weight + stone.rgb[i] * (1 - weight)),
    );
    value.roughness = value.roughness * weight + stone.roughness * (1 - weight);
  }
  return value;
}
