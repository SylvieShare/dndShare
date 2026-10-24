// Leave room for walls at the outer edge, not between a large creature's cells.
export function miniatureDiameter(size) {
  return size - Math.min(0.3, size * 0.3);
}

// referenceDiameter is an artist-defined standing circle, never mesh bounds.
// Body, LOD and shadow share this one calibration; appendages may overhang it.
export function miniatureScale(size, referenceDiameter) {
  if (
    !(size > 0) ||
    !Number.isFinite(size) ||
    !(referenceDiameter > 0) ||
    !Number.isFinite(referenceDiameter)
  )
    throw new RangeError(
      "Miniature size and reference diameter must be positive",
    );
  return miniatureDiameter(size) / referenceDiameter;
}
