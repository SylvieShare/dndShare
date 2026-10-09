import { afterEach, expect, it, vi } from "vitest";
import { Matrix4 } from "three";
const state = vi.hoisted(() => ({ load: vi.fn(), models: [] }));
vi.mock("./modelLoader", () => ({
  acquireModelLoader: () => ({
    key: "progressive",
    load: state.load,
    release() {},
  }),
}));
vi.mock("@/shared/api/mapsApi", () => ({
  getMapModels: async () => state.models,
}));
import { modelAssets } from "./modelAssets";
let asset;
afterEach(() => asset?.destroy());
const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
function gltf(url) {
  return {
    scene: {
      updateMatrixWorld() {},
      traverse(fn) {
        fn({
          isMesh: true,
          geometry: { url, dispose() {} },
          material: { dispose() {} },
          matrixWorld: new Matrix4(),
        });
      },
    },
  };
}
async function setup() {
  const resolve = new Map();
  state.load
    .mockReset()
    .mockImplementation(
      (url) => new Promise((done) => resolve.set(url, () => done(gltf(url)))),
    );
  const changed = vi.fn();
  asset = modelAssets(vi.fn(), undefined, changed);
  const catalogue = ["a", "b"].map((id) => ({
    id,
    lodUrl: `/${id}-lod`,
    renderUrl: `/${id}-render`,
    shadowUrl: `/${id}-shadow`,
  }));
  await asset.prepare(new Set(["a", "b"]), { catalogue });
  return { resolve, changed };
}
it("reveals each LOD independently and upgrades only that model after it is ready", async () => {
  const { resolve, changed } = await setup();
  asset.progressive(new Set(["a", "b"]), "render");
  expect(state.load.mock.calls.map((c) => c[0])).toEqual(["/a-lod", "/b-lod"]);
  expect(asset.visual("a", "render")).toBeNull();
  resolve.get("/a-lod")();
  await flush();
  expect(asset.visual("a", "render").parts[0].geometry.url).toBe("/a-lod");
  expect(asset.visual("b", "render")).toBeNull();
  expect(resolve.has("/a-render")).toBe(true);
  expect(resolve.has("/b-render")).toBe(false);
  resolve.get("/a-render")();
  await flush();
  expect(asset.visual("a", "render").parts[0].geometry.url).toBe("/a-render");
  expect(changed).toHaveBeenCalledTimes(2);
});
it("zooming out before coarse loading finishes skips an unnecessary full GLB", async () => {
  const { resolve } = await setup();
  asset.progressive(new Set(["a"]), "render");
  asset.progressive(new Set(["a"]), "lod");
  resolve.get("/a-lod")();
  await flush();
  expect(resolve.has("/a-render")).toBe(false);
});
it("blocking capture waits for its requested files while ordinary scene staging does not", async () => {
  const { resolve } = await setup();
  asset.progressive(new Set(["a"]), "lod");
  let complete = false;
  const wait = asset
    .ensure(new Set(["a"]), "lod", { catalogue: asset.catalogue() })
    .then(() => {
      complete = true;
    });
  await flush();
  expect(complete).toBe(false);
  resolve.get("/a-lod")();
  await wait;
  expect(complete).toBe(true);
});
it("an empty editor catalogue during startup fetches metadata for placed models", async () => {
  const catalogue = [{ id: "a", lodUrl: "/a-lod", renderUrl: "/a-render" }];
  state.models = catalogue;
  asset = modelAssets(() => {});
  await asset.prepare(new Set(["a"]), { catalogue: [] });
  expect(asset.metadata("a")).toEqual(catalogue[0]);
});
it("a failed model does not delay others and explicit retry reloads its failed assets", async () => {
  const errors = vi.fn();
  state.load.mockReset().mockImplementation(async (url) => {
    if (url.startsWith("/broken")) throw new Error("mesh failed");
    return gltf(url);
  });
  asset = modelAssets(errors);
  const catalogue = ["broken", "good"].map((id) => ({
    id,
    lodUrl: `/${id}-lod`,
    renderUrl: `/${id}-render`,
  }));
  await asset.prepare(new Set(["broken", "good"]), { catalogue });
  asset.progressive(new Set(["broken", "good"]), "render");
  await flush();
  expect(asset.visual("broken", "render")).toBeNull();
  expect(asset.visual("good", "render")).toBeTruthy();
  expect(errors).toHaveBeenCalled();
  state.load.mockImplementation(async (url) => gltf(url));
  asset.retryFailed();
  asset.progressive(new Set(["broken", "good"]), "render");
  await flush();
  expect(asset.visual("broken", "render")).toBeTruthy();
});
