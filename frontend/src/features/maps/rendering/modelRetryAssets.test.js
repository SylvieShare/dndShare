import { expect, it, vi } from "vitest";
import { Matrix4 } from "three";
const fake = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock("./modelLoader", () => ({
  acquireModelLoader: () => ({
    key: "retry-assets",
    load: fake.load,
    release() {},
  }),
}));
import { modelAssets } from "./modelAssets";
const flush = async () => {
  for (let n = 0; n < 40; n++) await Promise.resolve();
};
it("retries unavailable geometry automatically while independently finishing another model", async () => {
  vi.useFakeTimers();
  const progress = vi.fn();
  let failed = false;
  fake.load.mockImplementation(async (url) => {
    if (url === "/retry" && !failed) {
      failed = true;
      throw Object.assign(new Error("connection lost"), { status: 503 });
    }
    return {
      scene: {
        updateMatrixWorld() {},
        traverse(fn) {
          fn({
            isMesh: true,
            matrixWorld: new Matrix4(),
            geometry: { dispose() {} },
            material: { dispose() {} },
          });
        },
      },
    };
  });
  const assets = modelAssets(
    () => {},
    undefined,
    () => {},
    progress,
  );
  try {
    await assets.prepare(new Set(["bad", "good"]), {
      catalogue: [
        { id: "bad", name: "Стена", definitionId: "UD-001", lodUrl: "/retry" },
        { id: "good", lodUrl: "/good" },
      ],
    });
    assets.progressive(new Set(["bad", "good"]), "lod");
    await flush();
    expect(assets.visual("good", "lod")).toBeTruthy();
    expect(assets.visual("bad", "lod")).toBeNull();
    expect(progress.mock.lastCall[0]).toMatchObject({
      retrying: 1,
      remaining: 1,
    });
    expect(progress.mock.lastCall[0].errors[0]).toMatchObject({
      modelName: "Стена",
      definitionId: "UD-001",
      stage: "download",
      retryable: true,
    });
    await vi.advanceTimersByTimeAsync(1000);
    await flush();
    expect(assets.visual("bad", "lod")).toBeTruthy();
    expect(progress.mock.lastCall[0]).toMatchObject({
      remaining: 0,
      errors: [],
    });
  } finally {
    assets.destroy();
    await flush();
    vi.useRealTimers();
  }
});
