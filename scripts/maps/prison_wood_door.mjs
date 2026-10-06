import { makePrisonPainter } from "./prison_material.mjs";
import { finishWood } from "./organic_finish.mjs";
import { fitBakedMaterials } from "./material_mixture.mjs";
import { OLD_STONE } from "./masonry_palette.mjs";
import { paintStone } from "./ultimate_surface.mjs";
export function woodenGrillePartAt([x, y, z], spec) {
  if (z < 12.4) return "stone";
  if (z < 15.75) return x > 12.45 && z > 13.2 ? "iron" : "soil";
  if (z < 17.6 && x < 13.1) return "soil";
  const post = spec.posts.find((centre) => Math.abs(y - centre) < 2.1);
  if (post === undefined || x < 13.15 || x > 15.72) return "iron";
  if (z > 70.2) return "wood";
  const samples = spec.railSamples;
  let a = samples[0],
    b = samples.at(-1);
  for (let i = 1; i < samples.length; i++) {
    if (y <= samples[i][0]) {
      a = samples[i - 1];
      b = samples[i];
      break;
    }
  }
  const t = Math.max(0, Math.min(1, (y - a[0]) / (b[0] - a[0])));
  const onRail = a[1].some((range, i) => {
    const low = range[0] + (b[1][i][0] - range[0]) * t;
    const high = range[1] + (b[1][i][1] - range[1]) * t;
    return z > low - 0.1 && z < high + 0.1;
  });
  return onRail ? "iron" : "wood";
}
export function makeWoodenGrillePainter(spec) {
  const base = makePrisonPainter(spec, (p) => woodenGrillePartAt(p, spec));
  const detail = fitBakedMaterials([OLD_STONE, [0.34, 0.35, 0.33]]);
  return (rgb, p, n) => {
    const part = woodenGrillePartAt(p, spec);
    if (part === "wood")
      return finishWood(
        detail(rgb),
        p,
        n,
        "z",
        [
          14.4,
          spec.posts.reduce((a, b) =>
            Math.abs(p[1] - a) < Math.abs(p[1] - b) ? a : b,
          ),
          0,
        ],
        [0.32, 0.22, 0.12],
      );
    if (part === "stone") return { ...paintStone(rgb, p, n), part };
    return base(rgb, p, n);
  };
}
