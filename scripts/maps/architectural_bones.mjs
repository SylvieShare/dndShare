import { fitBakedMaterials } from "./material_mixture.mjs";
import { paintStone } from "./ultimate_surface.mjs";
import { finishBone } from "./bone_finish.mjs";
import { OLD_STONE, srgbToLinear } from "./masonry_palette.mjs";
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const srgb = (v) =>
  v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055;
function inVolume(p, v) {
  return (
    p[2] > v.minZ &&
    p.reduce((sum, n, i) => sum + ((n - v.centre[i]) / v.radius[i]) ** 2, 0) <
      1.05
  );
}
function nearPath(p, path) {
  return path.points.slice(1).some((b, i) => {
    const a = path.points[i],
      d = b.map((v, j) => v - a[j]);
    const t = clamp(
      d.reduce((sum, v, j) => sum + v * (p[j] - a[j]), 0) /
        d.reduce((sum, v) => sum + v * v, 0),
    );
    return Math.hypot(...p.map((v, j) => v - a[j] - t * d[j])) < path.radius;
  });
}
export function architecturalBonePartAt(p, spec) {
  return spec.heads.some((h) => inVolume(p, h)) ||
    spec.piles?.some((v) => inVolume(p, v)) ||
    spec.bonePaths?.some((path) => nearPath(p, path))
    ? "bone"
    : "stone";
}
export function makeArchitecturalBonePainter(spec) {
  const detailAt = fitBakedMaterials([OLD_STONE, [0.79, 0.72, 0.52]]);
  return (rgb, p, n, ao) => {
    const part = architecturalBonePartAt(p, spec),
      d = detailAt(rgb);
    if (part === "bone") return finishBone(d, p, ao, spec.boneGroups);
    return {
      ...paintStone(
        OLD_STONE.map((v) =>
          Math.round(clamp(srgb(srgbToLinear(v) * d)) * 255),
        ),
        p,
        n,
      ),
      part,
    };
  };
}
