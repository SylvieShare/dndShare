import { sampleHeight } from "./raised_material.mjs";
import { paintStone, stoneDetail } from "./ultimate_surface.mjs";
import { srgbToLinear } from "./masonry_palette.mjs";
import { surfaceNoise } from "./surface_noise.mjs";
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const srgb = (v) =>
  v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055;
export function groundGlyphAt(p, n, reference, spec) {
  return (
    Math.hypot(p[0], p[1]) < (spec.glyphRadius ?? 15.25) &&
    p[2] > 11.5 &&
    n[2] > 0.18 &&
    sampleHeight(reference, p[0], p[1]) - p[2] > (spec.glyphDepth ?? 0.65)
  );
}
export function makeGroundGlyphPainter(reference, spec) {
  return (rgb, p, n) => {
    if (!groundGlyphAt(p, n, reference, spec))
      return paintStone(rgb, p, n, spec);
    const d = clamp(stoneDetail(rgb), 0.78, 1.2);
    const grain = 0.94 + surfaceNoise(...p.map((v) => v * 0.8)) * 0.12;
    const t = spec.gradient
      ? clamp(
          (p[spec.gradient.axis] - spec.gradient.from) /
            (spec.gradient.to - spec.gradient.from),
        )
      : 0;
    const pigment = spec.pigment.map(
      (v, i) => v * (1 - t) + (spec.gradient?.color[i] ?? v) * t,
    );
    return {
      part: "glyph",
      rgb: pigment.map((v) =>
        Math.round(clamp(srgb(srgbToLinear(v) * d * grain)) * 255),
      ),
      roughness: 0.88,
      metallic: 0,
    };
  };
}
