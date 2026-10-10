import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { projectedBoneAt } from "./lost_cave_bone_view.mjs";
export async function loadReviewedCaveViews(report, masks) {
  const views = [];
  const cache = new Map();
  for (const mask of masks) {
    const base = path.resolve(
      import.meta.dirname,
      "../../models/collections/lost-cave/bone-views",
      report.model.sourceCode,
      mask.name,
    );
    let view = cache.get(mask.name);
    if (!view)
      view = {
        spec: JSON.parse(
          await fs.readFile(path.join(base, "reference.json"), "utf8"),
        ),
        data: await fs.readFile(path.join(base, "depth.bin")),
      };
    if (
      view.spec.sourceSHA256 !== report.model.assets.source.sha256 ||
      view.spec.cutHeight !== report.cutHeight ||
      JSON.stringify(view.spec.sourceShiftMM) !==
        JSON.stringify(report.sourceShiftMM) ||
      createHash("sha256").update(view.data).digest("hex") !==
        view.spec.fieldSHA256
    )
      throw new Error("Verified original source material projection required");
    cache.set(mask.name, view);
    views.push({ view, mask });
  }
  return (p) =>
    views.find(({ view, mask }) =>
      projectedBoneAt(
        p,
        view,
        mask.polygons,
        mask.toleranceMM,
        mask.depthPixelRadius ?? 0,
      ),
    )?.mask;
}
