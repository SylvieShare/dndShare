// Explicit measured volumes on both sides of a fused STL. The first matching
// region wins, so hardware/bones may override a broader timber/liquid volume.
import { finishBone } from "./bone_finish.mjs";
import { finishWood } from "./organic_finish.mjs";
import { surfaceNoise } from "./surface_noise.mjs";
import { addedSewerSurface } from "./toxic_sewer_reference.mjs";
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export function inSewerRegion(p, region) {
  if (region.min && p.some((v, i) => v < region.min[i])) return false;
  if (region.max && p.some((v, i) => v > region.max[i])) return false;
  if (
    region.ellipsoid &&
    p.reduce(
      (s, v, i) =>
        s +
        ((v - region.ellipsoid.centre[i]) / region.ellipsoid.radius[i]) ** 2,
      0,
    ) > 1
  )
    return false;
  if (region.path) {
    const near = region.path.slice(1).some((b, j) => {
      const a = region.path[j],
        d = b.map((v, i) => v - a[i]);
      const length = d.reduce((s, v) => s + v * v, 0);
      const t = length
        ? clamp(d.reduce((s, v, i) => s + v * (p[i] - a[i]), 0) / length)
        : 0;
      return (
        Math.hypot(...p.map((v, i) => v - a[i] - t * d[i])) < region.radius
      );
    });
    if (!near) return false;
  }
  return true;
}
export function sewerPartAt(p, spec, reference, shift = [0, 0]) {
  const local = [p[0] - shift[0], p[1] - shift[1], p[2]];
  return (
    spec.regions?.find(
      (r) =>
        inSewerRegion(local, r) &&
        (!r.added || addedSewerSurface(local, reference)),
    ) ?? { part: "stone" }
  );
}
export function finishSewerPart(region, p, n, ao) {
  const grain = surfaceNoise(...p.map((v) => v * 0.8));
  const coarse = surfaceNoise(...p.map((v) => v * 0.15));
  const detail = 0.82 + (0.18 * ao) / 255;
  if (region.part === "bone") return finishBone(detail, p, ao);
  if (region.part === "wood" && region.direction) {
    const dot = (a, b) => a.reduce((sum, v, i) => sum + v * b[i], 0);
    const cross = (a, b) => [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0],
    ];
    const unit = (v) => {
      const length = Math.hypot(...v);
      if (!length) throw Error("Wood direction must be nonzero");
      return v.map((x) => x / length);
    };
    const along = unit(region.direction),
      across = unit(
        cross(Math.abs(along[2]) < 0.9 ? [0, 0, 1] : [0, 1, 0], along),
      ),
      normal = cross(along, across);
    const basis = [along, across, normal],
      centre = region.centre ?? [0, 0, 0];
    return finishWood(
      detail,
      basis.map((a) =>
        dot(
          p.map((v, i) => v - centre[i]),
          a,
        ),
      ),
      basis.map((a) => dot(n, a)),
      "x",
      [0, 0, 0],
      region.tint ?? [0.44, 0.285, 0.1],
    );
  }
  if (region.part === "wood")
    return finishWood(
      detail,
      p,
      n,
      region.axis ?? "x",
      region.centre ?? [0, 0, 0],
      region.tint ?? [0.44, 0.285, 0.1],
    );
  const palette = {
    copper: [177, 134, 53],
    iron: [75, 76, 69],
    toxic: [126, 175, 26],
    rubble: [137, 108, 62],
    tentacle: [145, 164, 55],
    gold: [206, 155, 49],
  };
  const colours = region.color ?? palette[region.part];
  if (!colours) throw Error("Unknown sewer part: " + region.part);
  const metal = ["copper", "iron", "gold"].includes(region.part);
  const liquid = region.part === "toxic";
  const factor = detail * (0.94 + 0.12 * coarse + 0.04 * (grain - 0.5));
  return {
    part: region.part,
    rgb: colours.map((v) => Math.round(clamp(v * factor, 8, 245))),
    roughness: liquid
      ? 0.24 + 0.08 * grain
      : metal
        ? 0.52 + 0.12 * grain
        : 0.84 + 0.06 * grain,
    metallic: metal ? (region.part === "gold" ? 0.8 : 0.68) : 0,
  };
}
