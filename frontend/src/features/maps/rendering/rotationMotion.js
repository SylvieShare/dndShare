// Animate visual poses only. Saved rotations and footprints stay on the grid.
const turn = (from, to) => (((to - from) % 360 + 540) % 360) - 180;
export function createRotationMotion() {
  const states = new Map();
  function set(id, pose) {
    const state = states.get(id);
    if (!state) {
      states.set(id, { pose: { ...pose }, target: { ...pose }, elapsed: 280 });
      return;
    }
    const delta = turn(state.target.rotation, pose.rotation);
    if (delta) {
      const target = { ...pose, rotation: state.target.rotation + delta };
      const start = { ...state.pose },
        angle = ((target.rotation - start.rotation) * Math.PI) / 180;
      const c = Math.cos(angle),
        s = Math.sin(angle),
        a = 1 - c,
        det = a * a + s * s;
      const dx = target.x - (c * start.x - s * start.y),
        dy = target.y - (s * start.x + c * start.y);
      Object.assign(state, {
        start,
        target,
        elapsed: 0,
        pivot:
          det > 1e-8
            ? { x: (a * dx - s * dy) / det, y: (s * dx + a * dy) / det }
            : null,
      });
    } else {
      // Pointer translation and lift already have their own easing.
      const dx = pose.x - state.target.x,
        dy = pose.y - state.target.y;
      state.pose.x += dx;
      state.pose.y += dy;
      if (state.start) {
        state.start.x += dx;
        state.start.y += dy;
      }
      if (state.pivot) {
        state.pivot.x += dx;
        state.pivot.y += dy;
      }
      state.target.x = pose.x;
      state.target.y = pose.y;
      state.pose.elevation = state.target.elevation = pose.elevation;
      if (state.start) state.start.elevation = pose.elevation;
    }
  }
  function advance(delta) {
    let moving = false;
    for (const state of states.values()) {
      if (!state.start || state.elapsed >= 280) continue;
      state.elapsed = Math.min(280, state.elapsed + delta);
      const t = 1 - Math.pow(1 - state.elapsed / 280, 3),
        { start, target, pivot } = state;
      const angle = ((target.rotation - start.rotation) * t * Math.PI) / 180;
      state.pose.rotation =
        start.rotation + (target.rotation - start.rotation) * t;
      if (pivot) {
        const x = start.x - pivot.x,
          y = start.y - pivot.y;
        state.pose.x = pivot.x + x * Math.cos(angle) - y * Math.sin(angle);
        state.pose.y = pivot.y + x * Math.sin(angle) + y * Math.cos(angle);
      } else {
        state.pose.x = start.x + (target.x - start.x) * t;
        state.pose.y = start.y + (target.y - start.y) * t;
      }
      if (state.elapsed === 280) state.pose = { ...target };
      moving ||= state.elapsed < 280;
    }
    return moving;
  }
  return {
    set,
    advance,
    pose: (id) => states.get(id)?.pose,
    isMoving: () =>
      [...states.values()].some((s) => s.start && s.elapsed < 280),
    retain: (ids) => {
      for (const id of states.keys()) if (!ids.has(id)) states.delete(id);
    },
    clear: () => states.clear(),
  };
}
