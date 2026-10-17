import { FLOOR } from "../rendering/annotations";
export function focusViewportOffset(bounds, obstacle) {
  if (
    !bounds ||
    !obstacle ||
    obstacle.left >= bounds.right ||
    obstacle.right <= bounds.left ||
    obstacle.bottom <= bounds.top ||
    obstacle.top >= bounds.bottom
  )
    return { x: 0, y: 0 };
  return {
    x: (Math.max(bounds.left, obstacle.left) - bounds.left - bounds.width) / 2,
    y: 0,
  };
}
export function cameraFocusTarget(view, point, screenOffset = { x: 0, y: 0 }) {
  const pitch = ((view.tilt ?? 35.2643897) * Math.PI) / 180;
  const yaw = ((view.azimuth ?? view.rotation ?? 0) * Math.PI) / 180;
  const offset = ((point.elevation ?? FLOOR) - FLOOR) / Math.tan(pitch);
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
export function useCameraFocus(getView, applyView) {
  let frame = 0;
  function stop() {
    cancelAnimationFrame(frame);
    frame = 0;
  }
  function focusAt(point, screenOffset) {
    stop();
    const start = getView();
    if (!start || !point) return;
    const end = cameraFocusTarget(start, point, screenOffset);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      applyView(end);
      return;
    }
    const began = performance.now();
    function step(time) {
      const t = Math.max(0, Math.min(1, (time - began) / 360)),
        ease = 1 - (1 - t) ** 3;
      applyView({
        ...end,
        x: start.x + (end.x - start.x) * ease,
        y: start.y + (end.y - start.y) * ease,
      });
      frame = t < 1 ? requestAnimationFrame(step) : 0;
    }
    frame = requestAnimationFrame(step);
  }
  return { focusAt, stop };
}
