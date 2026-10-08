import { caveRockPixel, darkenCaveFloorJoints } from "./lost_cave_surface.mjs";
import { surfaceNoise } from "./surface_noise.mjs";
import { srgbToLinear } from "./masonry_palette.mjs";
const clamp = (v) => Math.max(0, Math.min(1, v));
const srgb = (v) =>
  v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055;
function inside(p, shape) {
  if (!shape) return false;
  if (shape.profile === "cylinder")
    return (
      p[2] >= shape.zRange[0] &&
      p[2] <= shape.zRange[1] &&
      ((p[0] - shape.centre[0]) / shape.radius[0]) ** 2 +
        ((p[1] - shape.centre[1]) / shape.radius[1]) ** 2 <=
        1
    );
  return (
    p.reduce(
      (sum, v, i) => sum + ((v - shape.centre[i]) / shape.radius[i]) ** 2,
      0,
    ) <= 1
  );
}
export function mushroomPartAt(p, n, spec, projectedPart) {
  const visiblePart = projectedPart?.(p);
  if (visiblePart) return visiblePart;
  const m = spec.mushrooms;
  const isBud = m.buds.some(
    (v) =>
      inside(p, v) &&
      p[2] >= v.minZ &&
      (!v.bounds ||
        p.every(
          (value, i) => value >= v.bounds.min[i] && value <= v.bounds.max[i],
        )),
  );
  if (m.budsPriority && isBud) return "bud";
  if ((m.warts ?? []).some((v) => inside(p, v))) return "wart";
  if (
    m.blue &&
    p[2] >= m.blue.minZ &&
    (p[2] >= 43 ||
      p[0] <=
        m.blue.lowXMax + (p[2] - m.blue.minZ) * (m.blue.lowXSlope ?? 0)) &&
    ((p[0] - m.blue.centre[0]) / m.blue.radius[0]) ** 2 +
      ((p[1] - m.blue.centre[1]) / m.blue.radius[1]) ** 2 <=
      1
  )
    return "blue";
  if (m.stalks.some((v) => v.profile === "cylinder" && inside(p, v)))
    return "stalk";
  if (m.disc && p[2] >= m.disc.minZ && inside(p, m.disc))
    return Math.hypot(...p.map((v, i) => v - m.disc.creamCentre[i])) <
      m.disc.creamRadius
      ? "disc-centre"
      : "disc";
  if (m.cap) {
    const capXY =
      ((p[0] - m.cap.centre[0]) / m.cap.radius[0]) ** 2 +
      ((p[1] - m.cap.centre[1]) / m.cap.radius[1]) ** 2;
    if (capXY <= 1 && p[2] >= m.capFloorMM)
      return n[2] < -0.3 ? "gills" : "cap";
  }
  if (m.stalks.some((v) => inside(p, v))) return "stalk";
  if (inside(p, m.shelf))
    return p[2] > m.shelfTopMinMM || n[2] > 0.45 ? "shelf" : "stalk";
  if (
    m.buds.some(
      (v) =>
        inside(p, v) &&
        p[2] >= v.minZ &&
        (!v.bounds ||
          p.every(
            (value, i) => value >= v.bounds.min[i] && value <= v.bounds.max[i],
          )),
    )
  )
    return "bud";
  return "rock";
}
export function paintMushrooms(p, n, ao, spec, projectedPart) {
  const part = mushroomPartAt(p, n, spec, projectedPart);
  if (part === "rock")
    return darkenCaveFloorJoints(caveRockPixel(p, n, ao, spec), p, spec);
  const m = spec.mushrooms;
  const tint =
    part === "blue"
      ? m.palette.blueLow.map(
          (v, i) =>
            v *
              (1 - clamp((p[2] - m.blue.minZ) / (m.blue.maxZ - m.blue.minZ))) +
            m.palette.blueHigh[i] *
              clamp((p[2] - m.blue.minZ) / (m.blue.maxZ - m.blue.minZ)),
        )
      : m.palette[part];
  const broad = surfaceNoise(...p.map((v) => v * 0.25));
  const grain = surfaceNoise(...p.map((v) => v * 3.2));
  const recess = (1 - clamp((ao / 255 - 0.68) / 0.32)) * 0.22;
  let variation = 0.93 + (broad - 0.5) * 0.16 + (grain - 0.5) * 0.035;
  if (part === "stalk" || part === "gills") {
    const fibres =
      Math.sin(
        (p[0] + p[1] * 0.7) * 9 + surfaceNoise(p[0], p[1], p[2] * 0.2) * 2,
      ) * 0.025;
    variation += fibres;
  }
  if (part === "shelf") {
    const radius = Math.hypot(
      p[0] - m.shelf.centre[0],
      p[1] - m.shelf.centre[1],
    );
    variation +=
      Math.sin(
        radius * 3.5 + surfaceNoise(p[0] * 0.3, p[1] * 0.3, p[2] * 0.1),
      ) * 0.07;
  }
  const rgb = tint.map((v) =>
    Math.round(clamp(srgb(srgbToLinear(v) * variation * (1 - recess))) * 255),
  );
  return {
    part,
    rgb,
    roughness:
      part === "cap" || part === "bud" || part === "blue"
        ? 0.55 + recess * 0.2
        : part === "shelf"
          ? 0.78
          : 0.87,
    metallic: 0,
  };
}
