import { FLOOR } from "../rendering/annotations";
export function cameraFocusTarget(view, point) {
  const pitch = ((view.tilt ?? 35.2643897) * Math.PI) / 180;
  const yaw = ((view.azimuth ?? view.rotation ?? 0) * Math.PI) / 180;
  const offset = ((point.elevation ?? FLOOR) - FLOOR) / Math.tan(pitch);
  return {
    ...view,
    fit: false,
    x: point.x - Math.sin(yaw) * offset,
    y: point.y - Math.cos(yaw) * offset,
  };
}
export function useCameraFocus(getView, applyView) {
  let frame = 0;
  function stop() {
    cancelAnimationFrame(frame);
    frame = 0;
  }
  function focusAt(point) {
    stop();
    const start = getView();
    if (!start || !point) return;
    const end = cameraFocusTarget(start, point);
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
