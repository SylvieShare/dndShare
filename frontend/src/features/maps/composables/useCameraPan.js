import { onBeforeUnmount } from "vue";

const directions = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};
// Movement depends on frame time rather than OS key-repeat intervals.
export function useCameraPan(readView, writeView, topView, onMove) {
  const held = new Set();
  let frame = 0,
    last = 0,
    velocity = [0, 0];
  function tick(time) {
    frame = 0;
    const dt = Math.min(0.04, Math.max(0.001, (time - last) / 1000 || 0.016));
    last = time;
    let x = 0,
      y = 0;
    for (const key of held) {
      x += directions[key][0];
      y += directions[key][1];
    }
    const length = Math.hypot(x, y) || 1;
    const factor = 1 - Math.exp(-dt * (held.size ? 18 : 26));
    velocity[0] += (x / length - velocity[0]) * factor;
    velocity[1] += (y / length - velocity[1]) * factor;
    const view = readView();
    if (view && Math.hypot(...velocity) > 0.003) {
      const top = topView();
      const yaw = ((top ? view.rotation : view.azimuth) * Math.PI) / 180;
      const pitch = ((top ? 90 : view.tilt) * Math.PI) / 180;
      const dx = (velocity[0] * dt * 300) / view.cellPixels;
      const dy = (velocity[1] * dt * 300) / (view.cellPixels * Math.sin(pitch));
      writeView({
        ...view,
        fit: false,
        x: view.x + dx * Math.cos(yaw) + dy * Math.sin(yaw),
        y: view.y - dx * Math.sin(yaw) + dy * Math.cos(yaw),
      });
      onMove?.();
    }
    if (held.size || Math.hypot(...velocity) > 0.003)
      frame = requestAnimationFrame(tick);
    else {
      velocity = [0, 0];
      last = 0;
    }
  }
  function down(key) {
    if (!directions[key]) return;
    held.add(key);
    if (!frame) {
      last = performance.now();
      frame = requestAnimationFrame(tick);
    }
  }
  function up(key) {
    if (held.has(key) && Math.hypot(...velocity) < 0.001)
      velocity = directions[key].map((n) => n * 0.45);
    held.delete(key);
  }
  function stop() {
    held.clear();
    cancelAnimationFrame(frame);
    frame = 0;
    last = 0;
    velocity = [0, 0];
  }
  onBeforeUnmount(stop);
  return { down, up, stop };
}
