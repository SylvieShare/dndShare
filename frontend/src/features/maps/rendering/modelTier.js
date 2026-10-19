// Separate thresholds prevent full layer rebuilds while zoom oscillates at 72px.
export function modelTier(pixels, previous, forceLod = false) {
  if (forceLod) return "lod";
  if (!previous) return pixels < 72 ? "lod" : "render";
  return previous === "render"
    ? pixels < 64
      ? "lod"
      : "render"
    : pixels >= 80
      ? "render"
      : "lod";
}
