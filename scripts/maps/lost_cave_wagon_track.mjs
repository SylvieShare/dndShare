import { wagonReferenceDistance } from "./lost_cave_wagon_reference.mjs";
import { paintWagon } from "./lost_cave_wagon.mjs";
import { paintRailway } from "./lost_cave_railway.mjs";
export function wagonOnTrackPartAt(p, spec, reference) {
  const local = [p[0], p[1], p[2] - spec.wagonOffsetZMM];
  return wagonReferenceDistance(local, reference) <= spec.wagonMatchMM
    ? "wagon"
    : "track";
}
export function paintWagonOnTrack(p, n, ao, spec, reference) {
  if (wagonOnTrackPartAt(p, spec, reference) === "wagon")
    return paintWagon([p[0], p[1], p[2] - spec.wagonOffsetZMM], n, ao, spec);
  return paintRailway([p[0], p[1], p[2] - spec.trackOffsetZMM], n, ao, spec);
}
