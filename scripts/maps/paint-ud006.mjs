import { prepareSurfaceRevision } from "./prepare-surface-revision.mjs";
import { paintTimberPixel, TIMBER_RECIPE } from "./ud006_material.mjs";
await prepareSurfaceRevision({
  code: "UD-006",
  folder: "ud006-painted",
  recipe: TIMBER_RECIPE,
  paintPixel: paintTimberPixel,
  parts: ["post", "brace", "foot", "stone"],
  colorReferenceVersion: 4,
});
