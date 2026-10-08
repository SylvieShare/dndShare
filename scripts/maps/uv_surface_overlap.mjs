export function uvSurfaceTracker(width, height, maxDistanceMM = 0.1) {
  if (
    ![width, height].every((v) => Number.isInteger(v) && v > 0) ||
    !Number.isFinite(maxDistanceMM) ||
    maxDistanceMM <= 0
  )
    throw new Error("Valid atlas size and UV surface tolerance required");
  const seen = new Uint8Array(width * height),
    positions = new Float32Array(width * height * 3);
  return (i, p) => {
    const offset = i * 3;
    if (seen[i]) {
      const distance = Math.hypot(
        ...p.map((v, c) => v - positions[offset + c]),
      );
      if (distance > maxDistanceMM)
        throw new Error(
          `Overlapping UV surfaces at ${i % width},${Math.floor(i / width)}: ${distance.toFixed(3)} mm apart`,
        );
    } else {
      seen[i] = 1;
      positions.set(p, offset);
    }
  };
}
