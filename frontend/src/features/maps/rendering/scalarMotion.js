export const reducedMapMotion = () =>
  !!globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
export function createScalarMotion(onSettled = () => {}) {
  const values = new Map();
  const moving = (s) => s.elapsed < s.duration;
  return {
    set(
      id,
      target,
      { immediate = false, duration = 400, initial = target } = {},
    ) {
      let state = values.get(id);
      if (!state) {
        state = {
          value: initial,
          from: initial,
          target: initial,
          elapsed: 0,
          duration: 0,
        };
        values.set(id, state);
      }
      if (immediate)
        Object.assign(state, {
          value: target,
          from: target,
          target,
          elapsed: 0,
          duration: 0,
        });
      else if (state.target !== target)
        Object.assign(state, {
          from: state.value,
          target,
          elapsed: 0,
          duration,
        });
    },
    value: (id, fallback = 0) => values.get(id)?.value ?? fallback,
    target: (id, fallback = 0) => values.get(id)?.target ?? fallback,
    flash(id) {
      const s = values.get(id);
      return !s || !moving(s)
        ? 1
        : 1 +
            Math.sin((Math.PI * s.elapsed) / s.duration) *
              1.25 *
              Math.abs(s.target - s.from);
    },
    advance(delta, immediate = false) {
      let wasMoving = false,
        active = false;
      for (const s of values.values()) {
        if (!moving(s)) continue;
        wasMoving = true;
        s.elapsed = immediate
          ? s.duration
          : Math.min(s.duration, s.elapsed + delta);
        const t = s.elapsed / s.duration,
          eased = t * t * (3 - 2 * t);
        s.value = s.from + (s.target - s.from) * eased;
        active ||= moving(s);
      }
      if (wasMoving && !active) onSettled();
      return active;
    },
    isMoving: () => [...values.values()].some(moving),
    retain(ids) {
      for (const id of values.keys()) if (!ids.has(id)) values.delete(id);
    },
    clear: () => values.clear(),
  };
}
