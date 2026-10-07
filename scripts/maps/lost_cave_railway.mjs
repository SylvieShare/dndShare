import { caveRockPixel } from "./lost_cave_surface.mjs";
import { finishWood } from "./organic_finish.mjs";
import { surfaceNoise } from "./surface_noise.mjs";
function profileAt(y, samples, fallback) {
  if (!samples) return fallback;
  if (y <= samples[0][0]) return samples[0][1];
  for (let i = 1; i < samples.length; i++) {
    const [a, x] = samples[i - 1],
      [b, v] = samples[i];
    if (y <= b) return x + ((v - x) * (y - a)) / (b - a);
  }
  return samples.at(-1)[1];
}
function onTie(x, y, t) {
  if (t.segment) {
    const [[ax, ay], [bx, by]] = t.segment,
      dx = bx - ax,
      dy = by - ay;
    const length = Math.hypot(dx, dy),
      along = ((x - ax) * dx + (y - ay) * dy) / length;
    return (
      along >= 0 &&
      along <= length &&
      Math.abs((x - ax) * dy - (y - ay) * dx) / length <= t.halfWidth
    );
  }
  return (
    (!t.x || (x >= t.x[0] && x <= t.x[1])) &&
    Math.abs(y - t.y - t.slope * x) <= t.halfWidth
  );
}
function onRail(x, y, z, r) {
  const distance = r.arc
    ? Math.abs(
        Math.hypot(x - r.arc.centre[0], y - r.arc.centre[1]) - r.arc.radius,
      )
    : Math.abs(x - profileAt(y, r.samples, r.x));
  return (
    distance <= r.halfWidth &&
    z >= profileAt(y, r.minZProfile, r.minZ) &&
    y >= r.y[0] &&
    y <= r.y[1]
  );
}

export function railwayPartAt([x, y, worldZ], spec) {
  const railway = spec.railway;
  const z = worldZ - profileAt(y, railway.grade, 0);
  if (railway.rails.some((r) => onRail(x, y, z, r))) return "iron";
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
    railway.ties.some((t) => onTie(x, y, t))
  )
    return "wood";
  return "rock";
}

export function paintRailway(p, n, ao, spec) {
  const part = railwayPartAt(p, spec);
  const grade = profileAt(p[1], spec.railway.grade, 0);
  if (part === "rock")
    return caveRockPixel(p, n, ao, {
      ...spec,
      floorHeightMM: spec.floorHeightMM + grade,
    });
  const detail =
    0.78 + 0.22 * Math.max(0, Math.min(1, (ao / 255 - 0.65) / 0.35));
  if (part === "wood") {
    const tie = spec.railway.ties.find((t) => onTie(p[0], p[1], t));
    const origin = tie.segment?.[0] || [0, tie.y];
    const angle = tie.segment
        ? Math.atan2(
            tie.segment[1][1] - origin[1],
            tie.segment[1][0] - origin[0],
          )
        : Math.atan(tie.slope),
      c = Math.cos(angle),
      s = Math.sin(angle);
    const local = [
      (p[0] - origin[0]) * c + (p[1] - origin[1]) * s,
      -(p[0] - origin[0]) * s + (p[1] - origin[1]) * c,
      p[2] - grade,
    ];
    const normal = [n[0] * c + n[1] * s, -n[0] * s + n[1] * c, n[2]];
    return finishWood(
      detail,
      local,
      normal,
      "x",
      [0, 0, 8.8],
      spec.railway.woodTint,
    );
  }
  const noise = surfaceNoise(...p.map((v) => v * 0.5));
  const rust = Math.max(0, Math.min(1, (noise - 0.55) * 1.7));
  const height = Math.max(0, Math.min(1, (p[2] - grade - 13.2) / 0.95));
  const top = Math.max(0, n[2]) * height * height * (3 - 2 * height) * 0.12;
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
