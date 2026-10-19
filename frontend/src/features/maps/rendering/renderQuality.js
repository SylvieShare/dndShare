export const FRAME_PIXEL_BUDGET = 6_000_000;

// Bound all screen-sized targets together instead of allocating Retina buffers
// proportional to an arbitrarily large monitor. Small canvases keep native AA.
export function renderPixelRatio(
  width,
  height,
  deviceRatio = globalThis.devicePixelRatio || 1,
) {
  return Math.min(
    1.5,
    deviceRatio,
    Math.sqrt(FRAME_PIXEL_BUDGET / Math.max(1, width * height)),
  );
}
