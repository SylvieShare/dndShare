import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { newMap } from "../lib/mapModel";
const state = vi.hoisted(() => ({
  renderer: null,
  create: vi.fn(),
  catalogue: [{ id: "floor", renderUrl: "/mesh1" }],
}));
vi.mock("@/shared/api/mapsApi", () => ({
  getMapModels: async () => state.catalogue,
}));
vi.mock("./mapRenderer", () => ({
  createMapRenderer: async (...args) => {
    state.create(...args);
    return state.renderer;
  },
}));
beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  state.create.mockClear();
  state.renderer = {
    update: vi.fn(async () => {}),
    camera: vi.fn(),
    snapshot: vi.fn(async () => new Blob(["webp"], { type: "image/webp" })),
    destroy: vi.fn(),
  };
  vi.stubGlobal("window", {
    document: {
      body: { append: vi.fn() },
      createElement: () => ({ setAttribute() {}, style: {}, remove() {} }),
    },
  });
});
afterEach(() => {
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
it("deduplicates visual snapshots across tags, queues distinct scenes and releases the idle GPU", async () => {
  const { requestMapSnapshot } = await import("./mapSnapshots");
  const d = newMap().document;
  const results = await Promise.all([
    requestMapSnapshot(d),
    requestMapSnapshot({ ...d, tags: ["forest"] }),
    requestMapSnapshot({ ...d, width: 20 }),
  ]);
  expect(results[0]).toBe(results[1]);
  expect(state.create).toHaveBeenCalledTimes(1);
  expect(state.renderer.update).toHaveBeenCalledTimes(2);
  expect(state.renderer.snapshot).toHaveBeenCalledTimes(2);
  expect(state.renderer.camera.mock.calls[0][0]).toMatchObject({
    fit: true,
    rotation: 0,
    azimuth: 45,
  });
  vi.advanceTimersByTime(15000);
  expect(state.renderer.destroy).toHaveBeenCalledOnce();
});
it("cancelled cards never create a renderer and a failed job does not block retry", async () => {
  const { requestMapSnapshot } = await import("./mapSnapshots");
  const abort = new AbortController();
  abort.abort();
  await expect(
    requestMapSnapshot(newMap().document, abort.signal),
  ).rejects.toMatchObject({ name: "AbortError" });
  expect(state.create).not.toHaveBeenCalled();
  state.renderer.update.mockRejectedValueOnce(new Error("missing model"));
  await expect(requestMapSnapshot(newMap().document)).rejects.toThrow(
    "missing model",
  );
  expect(state.renderer.destroy).toHaveBeenCalledOnce();
  await expect(requestMapSnapshot(newMap().document)).resolves.toMatchObject({
    type: "image/webp",
  });
  expect(state.create).toHaveBeenCalledTimes(2);
});
it("changing a used model's visual revision invalidates its cached screenshot", async () => {
  const { requestMapSnapshot } = await import("./mapSnapshots");
  const d = newMap().document;
  d.tiles = [{ id: "a", modelId: "floor", x: 1, y: 1, level: 0, rotation: 0 }];
  await requestMapSnapshot(d);
  state.catalogue[0].renderUrl = "/mesh2";
  await requestMapSnapshot(d);
  expect(state.renderer.snapshot).toHaveBeenCalledTimes(2);
});
