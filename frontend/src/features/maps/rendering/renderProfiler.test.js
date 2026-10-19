import { afterEach, expect, it, vi } from "vitest";
import { createRenderProfiler } from "./renderProfiler";
import { fakeGpu } from "./gpuTimings.fixture";
afterEach(() => vi.useRealTimers());

it("classifies flames present before observation and separates outline passes from markers", () => {
  vi.useFakeTimers();
  const { gpu, queries } = fakeGpu();
  let snapshot;
  const profiler = createRenderProfiler(
    gpu,
    () => {},
    () => 0,
  );
  const flames = {},
    markers = {};
  profiler.tag(flames, "effects");
  profiler.tag(markers, "overlays");
  const meshes = Array.from({ length: 6 }, () => ({ parent: flames }));
  const stop = profiler.observe((value) => (snapshot = value));
  profiler.begin();
  gpu.render({ draws: meshes.map((object) => ({ object })) });
  gpu.render({ overrideMaterial: {}, draws: [{ object: {} }] });
  gpu.render({
    userData: { renderCategory: "outline" },
    draws: [{ object: {} }],
  });
  gpu.render({ draws: [{ object: { parent: markers } }] });
  profiler.end();
  queries.forEach((query) => (query.ready = true));
  vi.advanceTimersByTime(500);
  expect(snapshot.gpu).toMatchObject({ effects: 1, outline: 2, overlays: 1 });
  stop();
});

it("has no GPU instrumentation without observers, retains the original sample bucket and stops on unsubscribe", () => {
  vi.useFakeTimers();
  const { gpu, queries } = fakeGpu();
  let clock = 0,
    snapshot;
  const render = gpu.render,
    profiler = createRenderProfiler(gpu, vi.fn(), () => clock);
  profiler.begin();
  profiler.mark("tiles");
  profiler.end();
  expect(gpu.getContext).not.toHaveBeenCalled();
  const root = {},
    mesh = { parent: root };
  profiler.tag(root, "tiles");
  const stop = profiler.observe((value) => {
    snapshot = value;
  });
  profiler.begin();
  clock = 2;
  profiler.mark("draw");
  gpu.render({ draws: [{ object: mesh }] });
  clock = 3;
  profiler.end();
  const first = [...queries];
  clock = 1100;
  profiler.begin();
  clock = 1102;
  profiler.mark("draw");
  gpu.render({ draws: [{ object: mesh }] });
  clock = 1103;
  profiler.end();
  first.forEach((q) => {
    q.ready = true;
  });
  clock = 1500;
  vi.advanceTimersByTime(500);
  expect(snapshot.history.find((b) => b.at === 0).gpu.tiles).toBe(1);
  expect(snapshot.history.find((b) => b.at === 1000).gpu).toBe(null);
  expect(snapshot.cpu.draw).toBe(1);
  stop();
  expect(gpu.render).toBe(render);
  expect(gpu.info.autoReset).toBe(true);
  expect(vi.getTimerCount()).toBe(0);
  expect(queries.every((q) => q.deleted)).toBe(true);
  profiler.destroy();
});
