import { fitBakedMaterials } from "./material_mixture.mjs";
import { paintStone } from "./ultimate_surface.mjs";
import { finishBone } from "./bone_finish.mjs";
import { OLD_STONE, srgbToLinear } from "./masonry_palette.mjs";
import { surfaceNoise } from "./surface_noise.mjs";
import { addedDistance } from "./added_bones.mjs";
import { makeTreasurePainter, treasurePartAt } from "./treasure_material.mjs";
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const srgb = (v) =>
  v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055;
function pathAt(p, path, radius) {
  return path.slice(1).some((b, i) => {
    const a = path[i],
      d = b.map((v, j) => v - a[j]);
    const t = clamp(
      d.reduce((s, v, j) => s + v * (p[j] - a[j]), 0) /
        d.reduce((s, v) => s + v * v, 0),
    );
    return Math.hypot(...p.map((v, j) => v - a[j] - t * d[j])) < radius;
  });
}
export function fountainPartAt(p, spec, bare) {
  const [x, y, z] = p;
  if (spec.variant === "treasure") return treasurePartAt(p, spec, bare);
  if (spec.variant === "crystal") {
    if (!bare) throw new Error("Crystal comparison reference required");
    if ((x > 10.3 && z < 38.5) || (z < 27.0 && Math.hypot(x - 11.5, y) > 11.9))
      return "stone";
    return z > 23.8 &&
      z < 40 &&
      x > -5.0 &&
      x < 13.75 &&
      Math.abs(y) < 15.2 &&
      addedDistance(p, bare) > 0.65
      ? "crystal"
      : "stone";
  }
  if (
    [...(spec.heads ?? []), ...(spec.boneTips ?? [])].some(
      (h) =>
        z > h.minZ &&
        p.reduce((s, v, i) => s + ((v - h.centre[i]) / h.radius[i]) ** 2, 0) <
          1.07,
    )
  )
    return "bone";
  if (
    spec.bones?.some(
      (path, i) =>
        z > (spec.boneDatums?.[i] ?? spec.boneDatum ?? 14.39) &&
        pathAt(p, path, spec.boneRadius ?? 1.15),
    )
  )
    return bare && z > 20 && addedDistance(p, bare) < 0.25 ? "stone" : "bone";
  if (spec.variant === "toxic") {
    if (!bare) throw new Error("Liquid comparison reference required");
    const pool =
      z > 20 && z < 27.7 && x < 11.3 && Math.hypot(x - 11.7, y) < 11.5;
    const stream =
      z > 25 &&
      z < 33.2 &&
      x < 10.8 &&
      Math.abs(y) < 3.6 &&
      pathAt(
        p,
        [
          [10.1, 0.3, 33.7],
          [9.8, 0.4, 30],
          [8.6, 0.8, 25.0],
        ],
        2.2,
      );
    return (pool || stream) && addedDistance(p, bare) > 0.55
      ? "toxic"
      : "stone";
  }
  if (
    z > 25.85 &&
    x < 11.05 &&
    spec.chains?.some((path) => pathAt(p, path, 1.5))
  )
    return "iron";
  return "stone";
}
export function makeFountainPainter(spec, bare) {
  if (spec.variant === "treasure") return makeTreasurePainter(spec, bare);
  const detailAt = fitBakedMaterials([OLD_STONE, ...(spec.oldPigments ?? [])]);
  const boneGroups = spec.boneTones
    ? spec.heads.map((h, i) => ({
        position: h.centre,
        tone: spec.boneTones[i],
      }))
    : undefined;
  return (rgb, p, n, ao) => {
    const part = fountainPartAt(p, spec, bare),
      d = detailAt(rgb);
    if (part === "crystal") {
      const mineral = surfaceNoise(...p.map((v) => v * 0.27));
      const crest = clamp(
        (d - 1.01) * 0.18 + Math.max(0, n[2]) * 0.035,
        0,
        0.15,
      );
      const tint = [0.39, 0.245, 0.55].map(
        (v, i) =>
          srgbToLinear(v) *
            clamp(d, 0.7, 1.3) *
            (0.88 + mineral * 0.24) *
            (1 - crest) +
          srgbToLinear([0.63, 0.52, 0.77][i]) * crest,
      );
      return {
        part,
        rgb: tint.map((v) => Math.round(clamp(srgb(v)) * 255)),
        roughness: 0.34 + (mineral - 0.5) * 0.08,
        metallic: 0,
      };
    }
    if (part === "bone") return finishBone(d, p, ao, boneGroups);
    if (part === "toxic") {
      const foam = clamp(
        (d - 1.05) * 0.25 + Math.max(0, n[2]) * 0.025,
        0,
        0.12,
      );
      const mottling = 0.93 + surfaceNoise(...p.map((v) => v * 0.42)) * 0.14;
      return {
        part,
        rgb: [0.48, 0.68, 0.12].map((v, i) =>
          Math.round(
            clamp(
              srgb(
                srgbToLinear(v) * d * mottling * (1 - foam) +
                  srgbToLinear([0.76, 0.81, 0.27][i]) * foam,
              ),
            ) * 255,
          ),
        ),
        roughness: 0.3,
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
        part,
      };
    const grain = surfaceNoise(...p.map((v) => v * 2.6)),
      wear = clamp((d - 1.04) * 0.27, 0, 0.18);
    return {
      part,
      rgb: [0.285, 0.305, 0.32].map((v, i) =>
        Math.round(
          clamp(
            srgb(
              srgbToLinear(v) * d * (1 - wear) +
                srgbToLinear([0.48, 0.5, 0.51][i]) * wear,
            ),
          ) * 255,
        ),
      ),
      roughness: 0.62 + (grain - 0.5) * 0.1,
      metallic: 0.65,
    };
  };
}
