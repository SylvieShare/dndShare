import { makeColumnHardwarePainter } from "./column_hardware.mjs";
import { fitBakedMaterials } from "./material_mixture.mjs";
import { paintStone } from "./ultimate_surface.mjs";
import { OLD_STONE, srgbToLinear } from "./masonry_palette.mjs";
const clamp = (v) => Math.max(0, Math.min(1, v));
const srgb = (v) =>
  v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055;
export function keyGlyphAt([x, y, z], n, spec) {
  return (
    Math.abs(x) < spec.button.half &&
    Math.abs(y) < spec.button.half &&
    z > spec.button.z[0] &&
    z < spec.button.z[1] &&
    n[2] > 0.65
  );
}
export function makeKeyColumnPainter(spec) {
  const detailAt = fitBakedMaterials([OLD_STONE, [0.8, 0.1, 0.05]]),
    base = spec.chainBand
      ? makeColumnHardwarePainter({ ...spec, variant: "square" })
      : undefined;
  return (rgb, p, n) => {
    const d = detailAt(rgb);
    if (keyGlyphAt(p, n, spec))
      return {
        part: "glyph",
        rgb: [0.65, 0.285, 0.205].map((v) =>
          Math.round(clamp(srgb(srgbToLinear(v) * d)) * 255),
        ),
        roughness: 0.78,
        metallic: 0,
      };
    if (base) return base(rgb, p, n);
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
  };
}
