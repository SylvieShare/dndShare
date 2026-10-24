import { reducedMapMotion } from "./scalarMotion";

// Logical placement snaps to cells; the rendered miniature follows that target.
export function createTokenMotion() {
  const poses = new Map();
  let active = false;
  return {
    begin() { active = false; },
    pose(id, target, moving, delta, immediate = false) {
      let pose = poses.get(id);
      if (!pose) {
        pose = { ...target, lift: 0 };
        poses.set(id, pose);
      }
      const amount = reducedMapMotion() || immediate ? 1 : 1 - Math.exp(-delta / 45);
      const lift = moving ? .22 : 0;
      for (const key of ["x", "y", "elevation"])
        pose[key] += (target[key] - pose[key]) * amount;
      pose.lift += (lift - pose.lift) * amount;
      if (Math.hypot(pose.x-target.x, pose.y-target.y, pose.elevation-target.elevation, pose.lift-lift) > .001)
        active = true;
      else Object.assign(pose, target, { lift });
      return { ...pose, elevation: pose.elevation + pose.lift };
    },
    isMoving: () => active,
    retain(ids) { for (const id of poses.keys()) if (!ids.has(id)) poses.delete(id); },
    clear() { poses.clear(); active = false; },
  };
}
