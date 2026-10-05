import { prepareSurfaceRevision } from "./prepare-surface-revision.mjs";
import { paintDebrisPixel, DEBRIS_RECIPE } from "./ud009_material.mjs";
await prepareSurfaceRevision({
  code: "UD-009",
  folder: "ud009-painted",
  recipe: DEBRIS_RECIPE,
  paintPixel: paintDebrisPixel,
  parts: ["base", "floor", "wall", "rubble"],
  colorReferenceVersion: 3,
});
