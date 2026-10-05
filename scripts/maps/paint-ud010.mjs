import { prepareSurfaceRevision } from "./prepare-surface-revision.mjs";
import { paintDoorPixel, DOOR_RECIPE } from "./ud010_material.mjs";
await prepareSurfaceRevision({
  code: "UD-010",
  folder: "ud010-painted",
  recipe: DOOR_RECIPE,
  paintPixel: paintDoorPixel,
  parts: ["wood", "iron", "stone"],
  updateMetallic: true,
  colorReferenceVersion: 3,
});
