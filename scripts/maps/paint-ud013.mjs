import fs from "node:fs/promises";
import path from "node:path";
import { prepareSurfaceRevision } from "./prepare-surface-revision.mjs";
import { makeSkullPainter, SKULL_RECIPE } from "./ud013_material.mjs";
const reference = JSON.parse(
  await fs.readFile(
    path.resolve(
      import.meta.dirname,
      "../../models/collections/ud013-floor.json",
    ),
    "utf8",
  ),
);
await prepareSurfaceRevision({
  code: "UD-013",
  folder: "ud013-painted",
  recipe: SKULL_RECIPE,
  paintPixel: makeSkullPainter(reference),
  parts: ["stone", "bone"],
  colorReferenceVersion: 3,
});
