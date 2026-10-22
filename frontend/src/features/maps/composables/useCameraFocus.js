import { FLOOR } from "../rendering/annotations";
export function focusViewportOffset(bounds, obstacle) {
  if (!bounds) return { x: 0, y: 0 };
  let left = bounds.left,
    right = bounds.right;
  for (const panel of Array.isArray(obstacle) ? obstacle : [obstacle]) {
    if (
      !panel ||
      panel.left >= bounds.right ||
      panel.right <= bounds.left ||
      panel.bottom <= bounds.top ||
      panel.top >= bounds.bottom
    )
      continue;
    if (panel.left <= bounds.left) left = Math.max(left, panel.right);
    else right = Math.min(right, panel.left);
  }
  return {
    x: right > left ? (left + right - bounds.left - bounds.right) / 2 : 0,
    y: 0,
  };
}
export function cameraFocusTarget(view, point, screenOffset = { x: 0, y: 0 }) {
  const pitch = ((view.tilt ?? 35.2643897) * Math.PI) / 180;
  const yaw = ((view.azimuth ?? view.rotation ?? 0) * Math.PI) / 180;
  const offset =
    ((point.elevation ?? FLOOR) - (view.elevation ?? FLOOR)) / Math.tan(pitch);
  const horizontal = (screenOffset.x || 0) / (view.cellPixels || 1),
    vertical =
      (screenOffset.y || 0) / ((view.cellPixels || 1) * Math.sin(pitch));
  return {
    ...view,
    fit: false,
    x:
      point.x -
      Math.sin(yaw) * offset -
      Math.cos(yaw) * horizontal -
      Math.sin(yaw) * vertical,
    y:
      point.y -
      Math.cos(yaw) * offset +
      Math.sin(yaw) * horizontal -
      Math.cos(yaw) * vertical,
  };
}
export function useCameraFocus(getView, applyView, beforeFocus = () => {}) {
  let frame = 0;
  function stop() {
    cancelAnimationFrame(frame);
    frame = 0;
  }
  function focusAt(point, screenOffset) {
    const start = getView();
    if (start && point)
      focusView(cameraFocusTarget(start, point, screenOffset));
  }
  function focusView(next) {
    beforeFocus();
    stop();
    const start = getView();
    if (!start || !next) return;
    start.elevation ??= FLOOR;
    const end = { ...start, ...next, fit: false };
    if (Number.isFinite(end.azimuth) && Number.isFinite(start.azimuth))
      end.azimuth =
        start.azimuth +
        ((((end.azimuth - start.azimuth) % 360) + 540) % 360) -
        180;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      applyView(end);
      return;
    }
    const began = performance.now();
    function step(time) {
      const t = Math.max(0, Math.min(1, (time - began) / 360)),
        ease = 1 - (1 - t) ** 3;
      const value = { ...end };
      for (const key of [
        "x",
        "y",
        "elevation",
        "azimuth",
        "tilt",
        "cellPixels",
      ])
        if (Number.isFinite(start[key]) && Number.isFinite(end[key]))
          value[key] = start[key] + (end[key] - start[key]) * ease;
      applyView(value);
      frame = t < 1 ? requestAnimationFrame(step) : 0;
    }
    frame = requestAnimationFrame(step);
  }
  return { focusAt, focusView, stop };
}
