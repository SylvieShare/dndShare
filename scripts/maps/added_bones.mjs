import { pairDetail } from "./raised_material.mjs";
import { paintStone } from "./ultimate_surface.mjs";
import { finishBone } from "./bone_finish.mjs";
import { OLD_STONE, srgbToLinear } from "./masonry_palette.mjs";
const toSrgb = (v) =>
  v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055;
export function addedDistance(p, reference) {
  const s = reference.spec,
    index = p.map((v, i) => Math.round((v - s.low[i]) / s.step));
  if (index.some((v, i) => v < 0 || v >= s.size[i])) return 0;
  return (
    reference.data[(index[2] * s.size[1] + index[1]) * s.size[0] + index[0]] /
    s.scale
  );
}
function inRegion(p, region) {
  const [x, y, z] = p;
  if (region.z && (z < region.z[0] || z > region.z[1])) return false;
  if (region.centre)
    return (
      Math.hypot(x - region.centre[0], y - region.centre[1]) < region.radius
    );
  const [a, b] = region.line,
    dx = b[0] - a[0],
    dy = b[1] - a[1];
  const t = Math.max(
    0,
    Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy)),
  );
  return (
    Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy) < region.radius ||
    (region.jointRadius &&
      [a, b].some(
        ([cx, cy]) => Math.hypot(x - cx, y - cy) < region.jointRadius,
      ))
  );
}
export function makeAddedBonePainter(reference, spec) {
  return (rgb, p, n, ao) => {
    const detail = pairDetail(rgb, [0.79, 0.72, 0.52]);
    const regions = spec.boneRegions?.filter((r) => inRegion(p, r));
    const permitted = !regions || regions.length > 0;
    if (
      permitted &&
      (regions?.some((r) => r.direct) || addedDistance(p, reference) > 0.4)
    )
      return finishBone(detail, p, ao, spec.boneGroups);
    const stone = OLD_STONE.map((v) =>
      Math.round(Math.min(1, toSrgb(srgbToLinear(v) * detail)) * 255),
    );
    return { ...paintStone(stone, p, n), part: "stone" };
  };
}
