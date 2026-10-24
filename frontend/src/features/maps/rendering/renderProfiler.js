import { createGpuTimings } from "./gpuTimings";
import { createPerformanceHistory } from "./performanceHistory";

export function createRenderProfiler(
  gpu,
  invalidate,
  now = () => performance.now(),
) {
  const observers = new Set(),
    tags = new WeakMap(),
    history = createPerformanceHistory(now);
  let timer,
    timings,
    current,
    enabled = false,
    autoReset,
    gpuAt = -Infinity;
  function classify(object, material, scene) {
    if (material?.isMeshDepthMaterial || material?.isMeshDistanceMaterial)
      return "shadows";
    if (scene?.overrideMaterial) return "outline";
    if (scene?.userData?.renderCategory) return scene.userData.renderCategory;
    for (let node = object; node; node = node.parent)
      if (tags.has(node)) return tags.get(node);
    return "other";
  }
  function publish() {
    timings?.poll();
    const snapshot = history.snapshot(!!timings?.supported);
    snapshot.gpuMode = timings?.granularity || "parts";
    for (const listener of observers) listener(snapshot);
  }
  function stop() {
    enabled = false;
    clearInterval(timer);
    timings?.stop();
    timings = null;
    current = null;
    gpu.info.autoReset = autoReset;
  }
  return {
    tag: (root, category) => tags.set(root, category),
    observe(listener) {
      observers.add(listener);
      if (!enabled) {
        enabled = true;
        history.reset();
        gpuAt = -Infinity;
        autoReset = gpu.info.autoReset;
        gpu.info.autoReset = false;
        timings = createGpuTimings(gpu, classify);
        timings.start();
        timer = setInterval(publish, 500);
        invalidate();
      }
      publish();
      return () => {
        observers.delete(listener);
        if (!observers.size && enabled) stop();
      };
    },
    begin() {
      if (!enabled) return;
      const at = now();
      current = {
        at,
        mark: at,
        phase: "other",
        parts: {},
        sample: at - gpuAt >= 200,
      };
      gpu.info.reset();
      if (current.sample) {
        const sample = current;
        gpuAt = at;
        timings.begin((parts) => sample.accept?.(parts));
      }
    },
    mark(phase) {
      if (!current) return;
      const at = now();
      current.parts[current.phase] =
        (current.parts[current.phase] || 0) + at - current.mark;
      current.mark = at;
      current.phase = phase;
    },
    end() {
      if (!current) return;
      const at = now();
      current.parts[current.phase] =
        (current.parts[current.phase] || 0) + at - current.mark;
      current.accept = history.frame(current.parts, gpu.info.render, at);
      if (current.sample) timings.end();
      current = null;
    },
    updateStart: () => (enabled ? now() : null),
    updateEnd(start) {
      if (enabled && start !== null) history.update(now() - start);
    },
    destroy() {
      if (enabled) stop();
      observers.clear();
    },
  };
}
