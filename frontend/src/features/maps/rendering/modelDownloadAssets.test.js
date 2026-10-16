import { afterEach, expect, it, vi } from "vitest";
import { Matrix4 } from "three";
const fake = vi.hoisted(() => ({ load: vi.fn(), release: vi.fn() }));
vi.mock("./modelLoader", () => ({
  acquireModelLoader: () => ({
    key: "download-assets",
    load: fake.load,
    release: fake.release,
  }),
}));
import { modelAssets } from "./modelAssets";
const flush = async () => {
  for (let i = 0; i < 30; i++) await Promise.resolve();
};
let owners = [];
afterEach(async () => {
  owners.forEach((owner) => owner.destroy());
  owners = [];
  await flush();
});
function setup() {
  const pending = new Map(),
    disposed = [];
  fake.load.mockReset().mockImplementation((url, schedule, progress) =>
    schedule(
      () =>
        new Promise((resolve) => {
          pending.set(url, {
            progress,
            finish() {
              resolve({
                scene: {
                  updateMatrixWorld() {},
                  traverse(fn) {
                    fn({
                      isMesh: true,
                      matrixWorld: new Matrix4(),
                      geometry: { dispose: () => disposed.push(url) },
                      material: { dispose() {} },
                    });
                  },
                },
              });
            },
          });
        }),
    ),
  );
  const make = (onProgress) => {
    const assets = modelAssets(vi.fn(), undefined, vi.fn(), onProgress);
    owners.push(assets);
    return assets;
  };
  return { pending, disposed, make };
}
it("shares one transfer between canvases while reporting each scene's complete plan and partial bytes", async () => {
  const { pending, disposed, make } = setup(),
    seenA = vi.fn(),
    seenB = vi.fn();
  const a = make(seenA),
    b = make(seenB);
  const catalogue = [
    {
      id: "tile",
      renderUrl: "/full",
      lodUrl: "/coarse",
      shadowUrl: "/coarse",
      assetBytes: { render: 900, lod: 100, shadow: 100 },
    },
  ];
  const ids = new Set(["tile"]);
  await a.prepare(ids, { catalogue });
  await b.prepare(ids, { catalogue });
  a.progressive(ids, "render", new Set(), true);
  b.progressive(ids, "render", new Set(), true);
  await flush();
  expect([...pending.keys()]).toEqual(["/coarse"]);
  expect(seenA.mock.lastCall[0]).toMatchObject({
    total: 2,
    remaining: 2,
    remainingBytes: 1000,
    active: 1,
    queued: 1,
  });
  pending.get("/coarse").progress({ loaded: 50, total: 100 });
  await flush();
  expect(seenA.mock.lastCall[0].remainingBytes).toBe(950);
  expect(seenB.mock.lastCall[0].remainingBytes).toBe(950);
  pending.get("/coarse").finish();
  await flush();
  expect([...pending.keys()]).toEqual(["/coarse", "/full"]);
  expect(seenA.mock.lastCall[0]).toMatchObject({
    ready: 1,
    remaining: 1,
    remainingBytes: 900,
  });
  a.destroy();
  seenA.mockClear();
  pending.get("/full").progress({ loaded: 450, total: 900 });
  await flush();
  expect(seenA).not.toHaveBeenCalled();
  expect(seenB.mock.lastCall[0].remainingBytes).toBe(450);
  pending.get("/full").finish();
  await flush();
  expect(seenB.mock.lastCall[0]).toMatchObject({
    ready: 2,
    remaining: 0,
    remainingBytes: 0,
  });
  expect(disposed).toEqual([]);
  b.destroy();
  await flush();
  expect(disposed.sort()).toEqual(["/coarse", "/full"]);
});
it("removes queued files when the scene changes and does not restart abandoned detail chains", async () => {
  const { pending, make } = setup(),
    progress = vi.fn(),
    assets = make(progress);
  const catalogue = Array.from({ length: 6 }, (_, i) => ({
    id: String(i),
    lodUrl: `/${i}-lod`,
    renderUrl: `/${i}-full`,
  }));
  await assets.prepare(new Set(catalogue.map((m) => m.id)), { catalogue });
  assets.progressive(new Set(catalogue.map((m) => m.id)), "render");
  await flush();
  expect(pending.size).toBe(3);
  assets.progressive(new Set(), "lod");
  await flush();
  for (const entry of pending.values()) entry.finish();
  await flush();
  expect(pending.size).toBe(3);
  expect(progress.mock.lastCall[0]).toMatchObject({ total: 0, remaining: 0 });
});
