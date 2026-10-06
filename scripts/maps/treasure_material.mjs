import { fitBakedMaterials } from "./material_mixture.mjs";
import { addedDistance } from "./added_bones.mjs";
import { paintStone } from "./ultimate_surface.mjs";
import { OLD_STONE, srgbToLinear } from "./masonry_palette.mjs";
import { surfaceNoise } from "./surface_noise.mjs";
import measured from "./ud044-treasure.json" with { type: "json" };
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const srgb = (v) =>
  v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055;
const inside = (p, h) =>
  p.reduce((s, v, i) => s + ((v - h.centre[i]) / h.radius[i]) ** 2, 0) < 1;
const silverAt = (p, h) =>
  h.slope
    ? ((p[0] - h.centre[0]) / h.radius[0]) ** 2 +
        ((p[1] - h.centre[1]) / h.radius[1]) ** 2 <
        1 &&
      Math.abs(
        p[2] -
          h.centre[2] -
          h.slope[0] * (p[0] - h.centre[0]) -
          h.slope[1] * (p[1] - h.centre[1]),
      ) < h.radius[2]
    : inside(p, h);
function nearNecklace(p, path) {
  return path.slice(1).some((b, i) => {
    const a = path[i],
      d = b.map((v, j) => v - a[j]);
    const t = clamp(
      d.reduce((s, v, j) => s + v * (p[j] - a[j]), 0) /
        d.reduce((s, v) => s + v * v, 0),
    );
    return Math.hypot(...p.map((v, j) => v - a[j] - d[j] * t)) < 0.7;
  });
}
export function treasurePartAt(p, spec, bare) {
  const regions = spec.regions ?? measured;
  if (!bare) throw new Error("Treasure comparison reference required");
  const [x, y, z] = p,
    radius = Math.hypot(x - 11.7, y);
  if (x > 11.3 || z < 13.55 || z > 34 || Math.abs(y) > 17.3) return "stone";
  const coin = regions.coins?.some(
    ([cx, cy, rx, ry, low, high]) =>
      z > low && z < high && ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < 1,
  );
  if (x > 10.3 && !coin) return "stone";
  const floor = z < 20 && radius > 14.75;
  const heap = z > 21 && (radius < 11.8 || z > 26.8);
  const core = z > 23 && radius < 11.6;
  const hanging = z > 18 && z < 27.5 && radius > 15.4;
  const necklace = regions.necklaces?.some((path) => nearNecklace(p, path));
  if (
    !coin &&
    !core &&
    !necklace &&
    !((floor || heap || hanging) && addedDistance(p, bare) > 0.35)
  )
    return "stone";
  if (regions.gems.some((g) => inside(p, g))) return "gem";
  if (regions.silvers.some((g) => silverAt(p, g))) return "silver";
  return "gold";
}
export function makeTreasurePainter(spec, bare) {
  const regions = spec.regions ?? measured;
  const detailAt = fitBakedMaterials([OLD_STONE, [0.72, 0.49, 0.16]]);
  return (rgb, p, n) => {
    const part = treasurePartAt(p, spec, bare),
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
    if (part === "gem") {
      const gem = regions.gems.find((g) => inside(p, g));
      return {
        part,
        rgb: gem.color.map((v) =>
          Math.round(clamp(srgb(srgbToLinear(v) * clamp(d, 0.7, 1.35))) * 255),
        ),
        roughness: 0.3,
        metallic: 0,
      };
    }
    const grain = surfaceNoise(...p.map((v) => v * 2.2));
    const worn = clamp((d - 1.04) * 0.16, 0, 0.1),
      dirt = clamp((0.84 - d) * 0.16, 0, 0.07);
    const tint =
      part === "silver" ? [0.53, 0.565, 0.585] : [0.685, 0.57, 0.255];
    const highlight =
      part === "silver" ? [0.75, 0.765, 0.775] : [0.88, 0.79, 0.49];
    return {
      part,
      rgb: tint.map((v, i) =>
        Math.round(
          clamp(
            srgb(
              srgbToLinear(v) * d * (1 - worn - dirt) +
                srgbToLinear(highlight[i]) * worn +
                srgbToLinear([0.255, 0.215, 0.145][i]) * dirt,
            ),
          ) * 255,
        ),
      ),
      roughness: (part === "silver" ? 0.36 : 0.43) + (grain - 0.5) * 0.05,
      metallic: part === "silver" ? 0.82 : 0.78,
    };
  };
}
