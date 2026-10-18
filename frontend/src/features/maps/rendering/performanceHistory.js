export const SAMPLE_MS = 500,
  HISTORY_BINS = 60;
const sum = (parts) => Object.values(parts).reduce((a, b) => a + b, 0);
const add = (target, parts) => {
  for (const [key, value] of Object.entries(parts))
    target[key] = (target[key] || 0) + value;
};
const mean = (parts, n) =>
  Object.fromEntries(
    Object.entries(parts).map(([key, value]) => [key, value / n]),
  );

export function createPerformanceHistory(now = () => performance.now()) {
  const buckets = new Map();
  let frames = [],
    lastFrame,
    started = now(),
    updateMs = null,
    lastCpu = null,
    lastGpu = null,
    lastCounts = { calls: 0, triangles: 0 };
  function bucket(at) {
    const key = Math.floor(at / SAMPLE_MS) * SAMPLE_MS;
    if (!buckets.has(key))
      buckets.set(key, {
        at: key,
        count: 0,
        cpu: {},
        gpu: {},
        gpuCount: 0,
        calls: 0,
        triangles: 0,
        max: 0,
      });
    return buckets.get(key);
  }
  return {
    reset() {
      buckets.clear();
      frames = [];
      lastFrame = undefined;
      started = now();
      updateMs = null;
      lastCpu = lastGpu = null;
      lastCounts = { calls: 0, triangles: 0 };
    },
    update(ms) {
      updateMs = ms;
    },
    frame(cpu, info, at = now()) {
      const b = bucket(at);
      b.count++;
      add(b.cpu, cpu);
      b.calls += info.calls;
      b.triangles += info.triangles;
      b.max = Math.max(b.max, sum(cpu));
      frames.push(at);
      lastFrame = at;
      return (gpu) => {
        add(b.gpu, gpu);
        b.gpuCount++;
      };
    },
    snapshot(gpuSupported) {
      const at = now(),
        first =
          Math.floor(at / SAMPLE_MS) * SAMPLE_MS -
          (HISTORY_BINS - 1) * SAMPLE_MS;
      for (const key of buckets.keys()) if (key < first) buckets.delete(key);
      frames = frames.filter((t) => t > at - 1000);
      const history = Array.from({ length: HISTORY_BINS }, (_, i) => {
        const time = first + i * SAMPLE_MS,
          b = buckets.get(time);
        return {
          at: time,
          cpu: b?.count ? mean(b.cpu, b.count) : null,
          gpu: b?.gpuCount ? mean(b.gpu, b.gpuCount) : null,
        };
      });
      const values = [...buckets.values()].sort((a, b) => a.at - b.at),
        latest = values.at(-1);
      const recent = values.filter((b) => b.at >= at - 2000),
        average = recent.length ? recent : latest ? [latest] : [];
      const cpu = {},
        gpu = {};
      let count = 0,
        gpuCount = 0;
      for (const b of average) {
        add(cpu, b.cpu);
        add(gpu, b.gpu);
        count += b.count;
        gpuCount += b.gpuCount;
      }
      const latestGpu = values.findLast((b) => b.gpuCount);
      const gpuParts = gpuCount
        ? mean(gpu, gpuCount)
        : latestGpu
          ? mean(latestGpu.gpu, latestGpu.gpuCount)
          : null;
      if (count) lastCpu = mean(cpu, count);
      if (gpuParts) lastGpu = gpuParts;
      if (latest)
        lastCounts = {
          calls: latest.calls / latest.count,
          triangles: latest.triangles / latest.count,
        };
      return {
        history,
        cpu: lastCpu,
        gpu: lastGpu,
        gpuSupported,
        fps:
          (frames.length * 1000) / Math.max(500, Math.min(1000, at - started)),
        idle: lastFrame === undefined || at - lastFrame > 1000,
        ...lastCounts,
        updateMs,
      };
    },
  };
}
