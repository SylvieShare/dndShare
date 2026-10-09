import { surfaceNoise } from "./surface_noise.mjs";

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
