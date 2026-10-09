import { caveRockPixel, darkenCaveFloorJoints } from "./lost_cave_surface.mjs";
import { surfaceNoise } from "./surface_noise.mjs";
const clamp = (v) => Math.max(0, Math.min(1, v));
const inside = (p, g) =>
  p.reduce((v, x, i) => v + ((x - g.centre[i]) / g.radius[i]) ** 2, 0) <= 1 &&
  p[2] >= g.minZ;
export function caveTreasurePartAt(p, spec, reference, projection) {
  if (!reference)
    throw new Error("Verified native bare-wall reference required");
  const t = spec.treasure;
  if (reference.distanceAt(p) <= t.wallReference.matchMM)
    return { part: "rock" };
  const rimRadius = Math.hypot(p[0] - t.wellCentre[0], p[1] - t.wellCentre[1]);
  if (p[0] > 1.8 && rimRadius > 10.5 && p[2] > 18 && p[2] < 23.75)
    return { part: "rock" };
  const projected = projection?.(p);
  if (projected)
    return projected.part === "gold"
      ? { part: "gold" }
      : { part: "gem", gem: { colour: projected.colour } };
  const gem = !projection?.isVisible(p) && t.gems.find((g) => inside(p, g));
  if (gem) return { part: "gem", gem };
  if (t.metals.some((g) => inside(p, g))) return { part: "gold" };
  const radius = Math.hypot(p[0] - t.wellCentre[0], p[1] - t.wellCentre[1]);
  if (
    p[0] > t.heapMinX &&
    radius < t.heapRadiusMM &&
    p[2] >= t.heapMinZMM &&
    p[2] <= t.heapMaxZMM
  )
    return { part: "gold" };
  return { part: "rock" };
}
export function paintCaveTreasure(p, n, ao, spec, reference, projection) {
  const classified = caveTreasurePartAt(p, spec, reference, projection);
  if (classified.part === "rock") {
    const t = spec.treasure;
    const radius = Math.hypot(p[0] - t.wellCentre[0], p[1] - t.wellCentre[1]);
    const shell =
      p[0] > 1.8 &&
      radius > t.heapRadiusMM - 0.6 &&
      radius < 13.2 &&
      p[2] > 16 &&
      p[2] < 24;
    const palette = shell
      ? { ...spec.palette, rock: t.wellTint }
      : spec.palette;
    return darkenCaveFloorJoints(
      caveRockPixel(p, n, ao, { ...spec, palette }),
      p,
      spec,
    );
  }
  const detail = 0.8 + 0.2 * clamp((ao / 255 - 0.65) / 0.35);
  if (classified.part === "gem") {
    const noise = surfaceNoise(...p.map((v) => v * 0.9));
    return {
      part: "gem",
      rgb: classified.gem.colour.map((v) =>
        Math.round(255 * clamp(v * detail * (0.9 + 0.18 * noise))),
      ),
      roughness: 0.2 + 0.06 * (1 - noise),
      metallic: 0,
      normalNeutral: true,
    };
  }
  const grain = surfaceNoise(...p.map((v) => v * 2.2));
  const dirt = clamp((1 - detail) * 0.7);
  return {
    part: "gold",
    rgb: spec.treasure.goldTint.map((v, i) =>
      Math.round(
        255 *
          clamp(
            (v * (1 - dirt) + [0.32, 0.22, 0.08][i] * dirt) *
              (0.94 + 0.12 * grain),
          ),
      ),
    ),
    roughness: 0.37 + grain * 0.09 + dirt * 0.3,
    metallic: 0.76 - dirt * 0.25,
  };
}
