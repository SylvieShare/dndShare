import { fitBakedMaterials } from "./material_mixture.mjs";
import { paintStone } from "./ultimate_surface.mjs";
import { finishWood, finishCloth } from "./organic_finish.mjs";
import { OLD_STONE, srgbToLinear } from "./masonry_palette.mjs";
import { surfaceNoise } from "./surface_noise.mjs";
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const srgb = (v) =>
  v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055;
function nearRope(p, path) {
  return path.slice(1).some((b, i) => {
    const a = path[i],
      d = b.map((v, j) => v - a[j]);
    const t = clamp(
      d.reduce((s, v, j) => s + v * (p[j] - a[j]), 0) /
        d.reduce((s, v) => s + v * v, 0),
    );
    return Math.hypot(...p.map((v, j) => v - a[j] - t * d[j])) < 0.85;
  });
}
export function weaponsPartAt([x, y, z], spec) {
  if (nearRope([x, y, z], spec.rope)) return "rope";
  if (x > 8.65 && x < 11.55 && Math.abs(y) < 14.8 && z > 28.2 && z < 43.8)
    return "iron";
  if (x > 11.4 && z > 41.0 && z < 49.2) return "beam";
  if (
    Math.abs(y) > 13.3 &&
    Math.abs(y) < 17.0 &&
    x > -1.5 &&
    x < 11.4 &&
    z > 14.9 &&
    z < 42
  )
    return "post";
  if (
    x > 9.0 &&
    x < 11.45 &&
    z > 16.4 &&
    z < 28.4 &&
    spec.shaftRows.some((cy) => Math.abs(y - cy) < 1.05)
  )
    return "shaft";
  if (x > 10.2 && x < 11.5 && Math.abs(y) < 15.0 && z > 14.7 && z < 17.8)
    return "beam";
  return "stone";
}
export function makeWeaponsPainter(spec) {
  const detailAt = fitBakedMaterials([
    OLD_STONE,
    [0.39, 0.22, 0.105],
    [0.34, 0.35, 0.33],
  ]);
  return (rgb, p, n) => {
    const part = weaponsPartAt(p, spec),
      d = detailAt(rgb);
    if (part === "stone")
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
    if (part === "rope") return finishCloth(d, p, n, [0.58, 0.5, 0.355], part);
    if (["beam", "post", "shaft"].includes(part))
      return {
        ...finishWood(
          d,
          p,
          n,
          part === "beam" ? "y" : "z",
          [12, 0, 30],
          [0.335, 0.275, 0.205],
        ),
        part,
      };
    const grain = surfaceNoise(...p.map((v) => v * 2.6)),
      wear = clamp((d - 1.0) * 0.22, 0, 0.14);
    return {
      part,
      rgb: [0.34, 0.365, 0.38].map((v, i) =>
        Math.round(
          clamp(
            srgb(
              srgbToLinear(v) * d * (1 - wear) +
                srgbToLinear([0.54, 0.56, 0.575][i]) * wear,
            ),
          ) * 255,
        ),
      ),
      roughness: 0.57 + (grain - 0.5) * 0.08,
      metallic: 0.7,
    };
  };
}
