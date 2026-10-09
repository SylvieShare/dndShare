import { surfaceNoise } from "./surface_noise.mjs";

export function finishMineCup(iron, p, n, spec) {
  const soot = spec.torch?.soot;
  if (!soot || spec.torch.lit) return iron;
  const dx = soot.centreMM[0] - p[0],
    dy = soot.centreMM[1] - p[1];
  if (
    p[2] < soot.minHeightMM ||
    p[2] > soot.maxHeightMM ||
    Math.hypot(dx, dy) > soot.radiusMM ||
    (n[0] * dx + n[1] * dy < 0.2 && n[2] < 0.5)
  )
    return iron;
  const grime = surfaceNoise(p[0] * 2, p[1] * 2, p[2]);
  return {
    part: "soot",
    rgb: [38, 39, 35].map((v) => Math.round(v * (0.85 + grime * 0.3))),
    roughness: 0.95,
    metallic: 0.12,
  };
}

export function paintMineFlame(p, spec, projection) {
  const torch = spec.torch;
  if (!torch?.lit || projection?.(p)?.part !== "flame") return;
  if (
    !torch.flameVolumes.some((v) =>
      p.every((x, i) => x >= v.min[i] && x <= v.max[i]),
    )
  )
    return;
  const height = Math.max(
      0,
      Math.min(
        1,
        (p[2] - torch.flameMinHeightMM) /
          (torch.flameMaxHeightMM - torch.flameMinHeightMM),
      ),
    ),
    curl = surfaceNoise(p[0] * 0.8, p[1] * 0.8, p[2] * 0.45),
    t = Math.max(0, Math.min(1, height + (curl - 0.5) * 0.12)),
    rgb = [255, 222, 62].map((v, i) =>
      Math.round(v * (1 - t) + [233, 67, 15][i] * t),
    );
  return {
    part: "flame",
    rgb,
    emission: rgb.map((v) => Math.round(v * 0.45)),
    roughness: 0.75,
    metallic: 0,
    normalNeutral: true,
  };
}
