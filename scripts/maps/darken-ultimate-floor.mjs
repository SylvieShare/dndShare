// One model per call; a seam-only revision preserves its review status and ORM.
import fs from "node:fs/promises";
import path from "node:path";
import { prepareSurfaceRevision } from "./prepare-surface-revision.mjs";
import { paintFloorJoint } from "./floor_seams.mjs";
const root = path.resolve(import.meta.dirname, "../.."),
  code = process.argv[2],
  sourceName = process.argv[3];
const registry = JSON.parse(
  await fs.readFile(
    path.join(root, "models/collections/registry.json"),
    "utf8",
  ),
);
const model = registry.filter(
  (m) =>
    m.collection === "ultimate-dungeon" &&
    m.sourceCode === code &&
    (!sourceName || m.sourceName === sourceName),
)[0];
if (!model) throw new Error("Missing " + code);
const rows = JSON.parse(
  await fs.readFile(
    path.join(root, "models/collections/manifest.json"),
    "utf8",
  ),
);
const row = rows.find(
  (r) =>
    r.collection === model.collection &&
    r.code === code &&
    r.sourceName === model.sourceName,
);
await prepareSurfaceRevision({
  code,
  sourceName: model.sourceName,
  folder:
    "floor-seams/" +
    code +
    (code === "UD-055" ? "_" + model.sourceName.replaceAll(" ", "_") : ""),
  recipe: "ultimate-floor-mortar-v1",
  paintPixel: (rgb, p, n, ao) =>
    paintFloorJoint(
      rgb,
      p,
      n,
      row.cutHeight,
      [model.width * 17.5, model.height * 17.5],
      ao,
    ),
  parts: ["unchanged", "joint"],
  textureDetail: model.textureDetail,
  preserveORM: true,
  preserveTextureSize: true,
  sampleAO: true,
  allowEmptyParts: true,
});
