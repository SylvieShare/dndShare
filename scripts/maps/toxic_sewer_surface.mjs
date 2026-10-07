import { surfaceNoise } from "./surface_noise.mjs";
import { sewerPartAt, finishSewerPart } from "./toxic_sewer_parts.mjs";
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (a, b, v) => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
// Coordinates are cropped, centred STL millimetres. Colour contains only
// surface variation and local sculpt crevices; lighting remains in the renderer.
export function sewerMasonryPixel(p, n, ao, spec, reference, shift) {
  const region = sewerPartAt(p, spec, reference, shift);
  p = [p[0] - (shift?.[0] ?? 0), p[1] - (shift?.[1] ?? 0), p[2]];
  if (region.part !== "stone") return finishSewerPart(region, p, n, ao);
  const [x, y, z] = p;
  const floor = n[2] > 0.5 && z < spec.floorHeightMM + 1;
  const coarse = surfaceNoise(x * 0.18, y * 0.18, z * 0.18);
  const fine = surfaceNoise(x * 1.6, y * 1.6, z * 1.6);
  const damp =
    (1 - clamp((z - 5) / 12, 0, 1)) *
    surfaceNoise(x * 0.08, y * 0.08, z * 0.08);
  const variation = 0.9 + 0.15 * coarse + 0.045 * (fine - 0.5) - 0.1 * damp;
  const cavity = clamp((ao / 255 - 0.65) / 0.35, 0, 1);
  const range = spec.floorJointRangeMM;
  const floorJoint =
    range && Math.abs(x) < 16.85 && Math.abs(y) < 16.85
      ? smooth(range[0], range[1], z) *
        (1 - smooth(range[2], range[3], z)) *
        smooth(-0.05, 0.5, n[2])
      : 0;
  const mortar = Math.max((1 - cavity) ** 1.25, floorJoint * 0.9);
  const rgb = spec.stoneColor.map((v, i) =>
    Math.round(
      clamp(
        v * variation * (1 - 0.5 * mortar) + spec.mortarColor[i] * 0.5 * mortar,
        12,
        240,
      ),
    ),
  );
  return {
    part: "stone",
    rgb,
    roughness: floor ? 0.79 + 0.08 * fine : 0.84 + 0.08 * fine,
    metallic: 0,
  };
}
