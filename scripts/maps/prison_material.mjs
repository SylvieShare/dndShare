import { fitBakedMaterials } from "./material_mixture.mjs";
import { paintStone } from "./ultimate_surface.mjs";
import { OLD_STONE, srgbToLinear } from "./masonry_palette.mjs";
import { surfaceNoise } from "./surface_noise.mjs";
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const srgb = (v) =>
  v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055;
export function prisonIronAt([x, y, z], spec) {
  if (spec.variant === "ground") return false;
  if (z > 17.6) return true;
  if (z < 15.0) return false;
  return spec.planes.some(
    ([axis, centre]) => Math.abs([x, y][axis] - centre) < 2.2,
  );
}
function nearPath(p, path) {
  return path.slice(1).some((b, i) => {
    const a = path[i],
      d = b.map((v, j) => v - a[j]);
    const t = clamp(
      d.reduce((s, v, j) => s + v * (p[j] - a[j]), 0) /
        d.reduce((s, v) => s + v * v, 0),
    );
    return Math.hypot(...p.map((v, j) => v - a[j] - t * d[j])) < 1.5;
  });
}
export function prisonPartAt(p, spec) {
  const [x, y, z] = p;
  if (spec.variant === "corner") {
    const ring = spec.rings.some(
      ([cx, cy]) =>
        Math.abs(Math.hypot(x - cx, y - cy) - 1.7) < 0.55 &&
        z > 13.2 &&
        z < 16.6,
    );
    const chain =
      z > 13.9 &&
      (x < 9.65 || y > -9.9 || z < 17.4) &&
      spec.chains.some((path) => nearPath(p, path));
    if (ring || chain) return "iron";
    if (x > 9.4 && y < -9.4 && z > 14.0) return "stone";
    return "soil";
  }
  return prisonIronAt(p, spec)
    ? "iron"
    : spec.ground === "earth"
      ? "soil"
      : "stone";
}
export function makePrisonPainter(spec, partAt = (p) => prisonPartAt(p, spec)) {
  const detailAt = fitBakedMaterials([OLD_STONE, [0.34, 0.35, 0.33]]);
  return (rgb, p, n) => {
    const d = detailAt(rgb),
      part = partAt(p);
    if (part === "soil") {
      const grain = 0.91 + surfaceNoise(...p.map((v) => v * 0.5)) * 0.18;
      const dust = clamp((d - 1.02) * 0.18 + Math.max(0, n[2]) * 0.02, 0, 0.12);
      return {
        part: "soil",
        rgb: [0.4, 0.315, 0.215].map((v, i) =>
          Math.round(
            clamp(
              srgb(
                srgbToLinear(v) * d * grain * (1 - dust) +
                  srgbToLinear([0.58, 0.465, 0.325][i]) * dust,
              ),
            ) * 255,
          ),
        ),
        roughness: 0.96,
        metallic: 0,
      };
    }
    if (part === "stone")
      return {
        ...paintStone(
          OLD_STONE.map((v) =>
            Math.round(clamp(srgb(srgbToLinear(v) * d)) * 255),
          ),
          p,
          n,
        ),
        part: "stone",
      };
    const grain = surfaceNoise(...p.map((v) => v * 2.7));
    const wear = clamp((d - 1.02) * 0.25, 0, 0.16),
      rust = clamp(
        (surfaceNoise(...p.map((v) => v * 0.21)) - 0.6) * 0.15,
        0,
        0.035,
      );
    return {
      part: "iron",
      rgb: [0.315, 0.345, 0.34].map((v, i) =>
        Math.round(
          clamp(
            srgb(
              srgbToLinear(v) * d * (1 - wear - rust) +
                srgbToLinear([0.51, 0.535, 0.52][i]) * wear +
                srgbToLinear([0.37, 0.255, 0.16][i]) * rust,
            ),
          ) * 255,
        ),
      ),
      roughness: 0.64 + (grain - 0.5) * 0.1,
      metallic: 0.66,
    };
  };
}
