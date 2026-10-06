import { fitBakedMaterials } from "./material_mixture.mjs";
import { paintStone } from "./ultimate_surface.mjs";
import { finishWood } from "./organic_finish.mjs";
import { sampleHeight } from "./raised_material.mjs";
import { OLD_STONE, srgbToLinear } from "./masonry_palette.mjs";
import { surfaceNoise } from "./surface_noise.mjs";
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const srgb = (v) =>
  v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055;
function nearPath(p, path, radius = 1.65) {
  return path.slice(1).some((b, i) => {
    const a = path[i],
      d = b.map((v, j) => v - a[j]);
    const t = clamp(
      d.reduce((sum, v, j) => sum + v * (p[j] - a[j]), 0) /
        d.reduce((sum, v) => sum + v * v, 0),
    );
    return Math.hypot(...p.map((v, j) => v - a[j] - t * d[j])) < radius;
  });
}
export function columnHardwarePartAt(p, spec, floor) {
  const [x, y, z] = p;
  if (spec.variant === "square") {
    const b = spec.chainBand;
    return z > b.z[0] &&
      z < b.z[1] &&
      Math.abs(x) > b.near &&
      Math.abs(y) > b.near &&
      Math.abs(x) < b.far &&
      Math.abs(y) < b.far &&
      Math.hypot(x, y) > b.radius
      ? "iron"
      : "stone";
  }
  if (spec.variant !== "slave") throw new Error("Unreviewed column hardware");
  const ring = spec.rings.some(
    ([cx, cy]) => Math.abs(Math.hypot(x - cx, y - cy) - 2.6) < 0.8,
  );
  if (
    z > sampleHeight(floor, x, y) + 0.2 &&
    (ring || spec.floorChains.some((path) => nearPath(p, path)))
  )
    return "iron";
  const vertical =
    ((x > 8.0 && x < 13.5) || (x < -9.0 && x > -13.5)) &&
    Math.abs(y) < 3.1 &&
    z > 17;
  const crossedPins =
    (Math.abs(x) > 9.8 || (z < 67 && Math.abs(x) > 9.0)) &&
    Math.abs(x) < 15.5 &&
    Math.abs(y) < 7.0 &&
    z > 56;
  const backPins = spec.backPins.some((path) => nearPath(p, path, 1.3));
  const sideBolts =
    Math.abs(y) > 8.85 &&
    Math.abs(y) < 11.0 &&
    Math.abs(x) < 8.5 &&
    z > 50 &&
    z < 67;
  const topBolts =
    z > 68.4 &&
    spec.topBolts.some(([cx, cy]) => Math.hypot(x - cx, y - cy) < 1.9);
  if (vertical || crossedPins || backPins || sideBolts || topBolts)
    return "iron";
  const timber =
    z > 15.5 &&
    ((Math.abs(x) < 9.6 && Math.abs(y) < 8.85) ||
      (z > 67 && Math.abs(x) < 9.6 && Math.abs(y) < 9.6));
  return timber ? "wood" : "stone";
}
export function makeColumnHardwarePainter(spec, floor) {
  const detailAt = fitBakedMaterials([
    OLD_STONE,
    [0.39, 0.22, 0.105],
    [0.34, 0.35, 0.33],
  ]);
  return (rgb, p, n) => {
    const part = columnHardwarePartAt(p, spec, floor),
      d = detailAt(rgb);
    if (part === "wood")
      return finishWood(d, p, n, "z", [0, 0, 15.5], [0.335, 0.275, 0.195]);
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
    const grain = surfaceNoise(...p.map((v) => v * 2.5)),
      wear = clamp((d - 1.02) * 0.27, 0, 0.15);
    return {
      part,
      rgb: [0.32, 0.35, 0.33].map((v, i) =>
        Math.round(
          clamp(
            srgb(
              srgbToLinear(v) * d * (1 - wear) +
                srgbToLinear([0.54, 0.565, 0.54][i]) * wear,
            ),
          ) * 255,
        ),
      ),
      roughness: 0.62 + (grain - 0.5) * 0.1,
      metallic: 0.68,
    };
  };
}
