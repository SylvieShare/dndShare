import { wagonReferenceDistance } from "./lost_cave_wagon_reference.mjs";
import { paintWagon } from "./lost_cave_wagon.mjs";
import { paintRailway } from "./lost_cave_railway.mjs";
import { paintCrystal } from "./lost_cave_crystal.mjs";
export function wagonLocalPoint(p, spec) {
  const sign = spec.wagonRotationZDeg === 180 ? -1 : 1;
  return [p[0] * sign, p[1] * sign, p[2] - spec.wagonOffsetZMM];
}
export function wagonOnTrackPartAt(p, spec, reference) {
  const local = wagonLocalPoint(p, spec);
  if (wagonReferenceDistance(local, reference) <= spec.wagonMatchMM)
    return "wagon";
  if (
    spec.cargo &&
    p.every((v, i) => v >= spec.cargo.min[i] && v <= spec.cargo.max[i])
  )
    return "crystal";
  return "track";
}
export function paintWagonOnTrack(p, n, ao, spec, reference) {
  const part = wagonOnTrackPartAt(p, spec, reference);
  if (part === "wagon") {
    const sign = spec.wagonRotationZDeg === 180 ? -1 : 1;
    return paintWagon(
      wagonLocalPoint(p, spec),
      [n[0] * sign, n[1] * sign, n[2]],
      ao,
      spec,
    );
  }
  if (part === "crystal") return paintCrystal(p, n, ao, spec);
  return paintRailway([p[0], p[1], p[2] - spec.trackOffsetZMM], n, ao, spec);
}
