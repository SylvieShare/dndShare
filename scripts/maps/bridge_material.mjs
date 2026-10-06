import broken from "./ud020-bones.json" with { type: "json" };
import full from "./ud019-bones.json" with { type: "json" };
import { paintStone, stoneDetail } from "./ultimate_surface.mjs";
import { finishBone } from "./bone_finish.mjs";
import { surfaceNoise } from "./surface_noise.mjs";
import { srgbToLinear } from "./masonry_palette.mjs";
const lineDistance = (p, a, b) => {
  const delta = b.map((v, i) => v - a[i]),
    length = delta.reduce((sum, v) => sum + v * v, 0);
  const t = Math.max(
    0,
    Math.min(
      1,
      delta.reduce((sum, v, i) => sum + v * (p[i] - a[i]), 0) / length,
    ),
  );
  return {
    distance: Math.hypot(...p.map((v, i) => v - a[i] - t * delta[i])),
    height: a[2] + t * delta[2],
  };
};
function pathAt([x, y], a, b, radius) {
  return lineDistance([x, y, 0], [...a, 0], [...b, 0]).distance < radius;
}
export function bridgeBoneAt([x, y, z]) {
  return measuredBoneAt([x, y, z], full);
}
export function bridgeIronAt([x, y, z]) {
  if (bridgeBoneAt([x, y, z])) return false;
  const top = x > -8 && x < 18 && y > 10.5 && y < 16.8 && z > 29.7;
  const rearLock = x > 8 && x < 19 && y > 5 && y < 13.5 && z > 25.45;
  const bottom = x > -16 && x < 12 && y > -16.8 && y < -9 && z > 29.7;
  return top || rearLock || bottom;
}
function paintBridgeIron(rgb, p) {
  const [x, y, z] = p,
    detail = stoneDetail(rgb),
    grain = surfaceNoise(x * 3, y * 3, z * 3);
  const toSrgb = (v) =>
    v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055;
  const wear = Math.max(0, detail - 1.03) * 0.22;
  return {
    part: "iron",
    rgb: [0.26, 0.275, 0.285].map((v) =>
      Math.round(
        Math.min(
          1,
          toSrgb(
            srgbToLinear(v) * detail * (1 + (grain - 0.5) * 0.1) * (1 - wear) +
              srgbToLinear(0.43) * wear,
          ),
        ) * 255,
      ),
    ),
    roughness: 0.64 + (grain - 0.5) * 0.08,
    metallic: 0.55,
  };
}
function measuredBoneAt(p, bones) {
  const [x, y, z] = p;
  if (
    bones.heads.some(
      (h) =>
        z > h.minZ &&
        p.reduce(
          (sum, v, i) => sum + ((v - h.centre[i]) / h.radius[i]) ** 2,
          0,
        ) < 1.1,
    )
  )
    return true;
  return bones.paths.some((points) =>
    points.slice(1).some((b, i) => {
      const d = lineDistance(p, points[i], b);
      return d.distance < 1.05 && z > d.height - 0.12;
    }),
  );
}
export function brokenBridgeBoneAt(p) {
  return measuredBoneAt(p, broken);
}
export function makeBridgePainter(code) {
  const mask = code === "UD-019" ? bridgeBoneAt : brokenBridgeBoneAt;
  return (rgb, p, n, ao) => {
    if (mask(p)) return finishBone(stoneDetail(rgb), p, ao);
    if (code === "UD-019" && bridgeIronAt(p)) return paintBridgeIron(rgb, p);
    return { ...paintStone(rgb, p, n), part: "stone" };
  };
}
