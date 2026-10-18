import { createScalarMotion, reducedMapMotion } from "./scalarMotion";
export function createAreaTransitions(onSettled) {
  const motion = createScalarMotion(onSettled);
  let initialized = false,
    instant = true;
  return {
    sync(document, options = {}) {
      const immediate =
          !initialized || options.animate === false || reducedMapMotion(),
        keys = new Set();
      instant = immediate;
      for (const area of document.areas) {
        const hidden = `hidden:${area.id}`,
          fog = `fog:${area.id}`;
        keys.add(hidden);
        keys.add(fog);
        motion.set(hidden, area.hidden ? 0 : 1, {
          immediate,
          duration: 480,
          initial: 1,
        });
        motion.set(fog, area.fog ? 1 : 0, {
          immediate,
          duration: 680,
          initial: 0,
        });
      }
      motion.retain(keys);
      initialized = true;
    },
    instant: () => instant,
    visibility: (id) => motion.value(`hidden:${id}`, 1),
    flash: (id) => motion.flash(`hidden:${id}`),
    fog: (id) => motion.value(`fog:${id}`),
    fogActive: (id) =>
      motion.value(`fog:${id}`) > 0 || motion.target(`fog:${id}`) > 0,
    advance: (delta) => motion.advance(delta, reducedMapMotion()),
    destroy: motion.clear,
  };
}
