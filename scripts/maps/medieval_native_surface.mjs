// Restore the native STL frame after canonical placement around the mount axis.
import assert from "node:assert/strict";
import { rasterizeSurface, seedSurfaceGutters } from "./uv_surface.mjs";

export function nativeSurfaceSamplers(centreMM) {
  assert.ok(Array.isArray(centreMM) && centreMM.length === 2 && centreMM.every(Number.isFinite),
    "A finite native mounting centre is required");
  const [cx, cy] = centreMM;
  if (cx === 0 && cy === 0) return { rasterizeSurface, seedSurfaceGutters };
  const nativeVisitor = visitor => (index, position, ...attributes) =>
    visitor(index, [position[0] + cx, position[1] + cy, position[2]], ...attributes);
  return {
    rasterizeSurface(doc, width, height, visitor, slot, colourSemantic) {
      return rasterizeSurface(doc, width, height, nativeVisitor(visitor), slot, colourSemantic);
    },
    seedSurfaceGutters(doc, width, height, coverage, visitor, radius, slot, colourSemantic) {
      return seedSurfaceGutters(doc, width, height, coverage, nativeVisitor(visitor), radius, slot, colourSemantic);
    },
  };
}
