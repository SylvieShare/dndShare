import { caveRockPixel } from "./lost_cave_surface.mjs";
import { finishWood } from "./organic_finish.mjs";
import { surfaceNoise } from "./surface_noise.mjs";

export function railwayPartAt([x, y, z], spec) {
  const railway = spec.railway;
  if (
    railway.rails.some(
      (r) =>
        Math.abs(x - r.x) <= r.halfWidth &&
        z >= r.minZ &&
        y >= r.y[0] &&
        y <= r.y[1],
    )
  )
    return "iron";
  if (
    railway.bolts.some(
      (b) => Math.hypot(x - b.x, y - b.y) <= b.radius && z >= b.minZ,
    )
  )
    return "iron";
  if (
    Math.abs(x) <= railway.timberHalfLength &&
    z >= railway.timberMinZ &&
    z <= railway.timberMaxZ &&
    railway.ties.some((t) => Math.abs(y - t.y - t.slope * x) <= t.halfWidth)
  )
    return "wood";
  return "rock";
}

export function paintRailway(p, n, ao, spec) {
  const part = railwayPartAt(p, spec);
  if (part === "rock") return caveRockPixel(p, n, ao, spec);
  const detail =
    0.78 + 0.22 * Math.max(0, Math.min(1, (ao / 255 - 0.65) / 0.35));
  if (part === "wood") {
    const tie = spec.railway.ties.reduce((a, b) =>
      Math.abs(p[1] - a.y - a.slope * p[0]) <
      Math.abs(p[1] - b.y - b.slope * p[0])
        ? a
        : b,
    );
    return finishWood(
      detail,
      p,
      n,
      "x",
      [0, tie.y, 8.8],
      spec.railway.woodTint,
    );
  }
  const noise = surfaceNoise(...p.map((v) => v * 0.5));
  const rust = Math.max(0, Math.min(1, (noise - 0.55) * 1.7));
  const top = Math.max(0, n[2]) * (p[2] > 13.8 ? 0.12 : 0);
  return {
    part,
    rgb: [0.29, 0.3, 0.285].map((v, i) =>
      Math.round(
        255 * detail * (v * (1 - rust) + [0.35, 0.21, 0.11][i] * rust + top),
      ),
    ),
    roughness: 0.54 + rust * 0.25 - top,
    metallic: 0.82 * (1 - rust * 0.6),
  };
}
