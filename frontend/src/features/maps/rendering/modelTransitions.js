import { createScalarMotion, reducedMapMotion } from "./scalarMotion";

// Reuse the area flash curve and post-lighting material effect. Only a changed
// instance pulses; LOD upgrades, initial loads and new placements stay quiet.
export function createModelTransitions(onSettled) {
  const motion = createScalarMotion(onSettled),
    models = new Map(),
    pending = new Map(),
    active = new Set();
  let instant = false;
  const flash = (id) => (active.has(id) ? motion.flash(id) : 1);
  return {
    sync(tiles, options = {}) {
      instant = options.animate === false || reducedMapMotion();
      const ids = new Set();
      for (const tile of tiles) {
        ids.add(tile.id);
        if (models.has(tile.id) && models.get(tile.id) !== tile.modelId) {
          pending.set(tile.id, tile.modelId);
          active.delete(tile.id);
        }
        models.set(tile.id, tile.modelId);
      }
      for (const id of models.keys())
        if (!ids.has(id)) {
          models.delete(id);
          pending.delete(id);
          active.delete(id);
        }
      if (instant) {
        pending.clear();
        active.clear();
      }
      motion.retain(active);
    },
    ready(isReady) {
      if (instant || reducedMapMotion()) return;
      for (const [id, model] of pending)
        if (isReady(model)) {
          motion.set(id, 0, { immediate: true });
          motion.set(id, 1, { duration: 480 });
          active.add(id);
          pending.delete(id);
        }
    },
    flash,
    groups: () => [...active],
    appearance(base) {
      return {
        ...base,
        tileFlash: (id) => Math.max(base.tileFlash(id), flash(id)),
        tileGroup: (id) =>
          active.has(id)
            ? `${base.tileGroup(id)}:model:${id}`
            : base.tileGroup(id),
      };
    },
    advance(delta) {
      const moving = motion.advance(delta, instant || reducedMapMotion());
      for (const id of active) if (motion.value(id) === 1) active.delete(id);
      motion.retain(active);
      return moving;
    },
    destroy() {
      models.clear();
      pending.clear();
      active.clear();
      motion.clear();
    },
  };
}
