// Leave room for walls at the outer edge, not between a large creature's cells.
export function miniatureBaseDiameter(size) {
  return size - Math.min(0.3, size * 0.3);
}

function scale(size, referenceDiameter, diameter) {
  if (
    !(size > 0) ||
    !Number.isFinite(size) ||
    !(referenceDiameter > 0) ||
    !Number.isFinite(referenceDiameter)
  )
    throw new RangeError(
      "Miniature size and reference diameter must be positive",
    );
  return diameter / referenceDiameter;
}

// Preserve authored proportions as footprint size grows. Large bodies are 2x
// their one-cell version, independent of the base's fixed outer wall clearance.
export function miniatureBodyScale(size, referenceDiameter) {
  return scale(size, referenceDiameter, size * 0.7);
}

// Bases retain a fixed outer margin on multi-cell footprints and their native Y.
export function miniatureBaseScale(size, referenceDiameter) {
  return scale(size, referenceDiameter, miniatureBaseDiameter(size));
}
