import { expect, it, vi } from "vitest";
import { Matrix4 } from "three";
const state = vi.hoisted(() => ({
  load: vi.fn(),
  release: vi.fn(),
  models: [],
}));
vi.mock("@/shared/api/mapsApi", () => ({
  getMapModels: async () => state.models,
}));
vi.mock("./modelLoader", () => ({
  acquireModelLoader: () => ({
    key: "test",
    load: state.load,
    release: state.release,
  }),
}));
import { modelAssets } from "./modelAssets";
it("replaces GLB resources at the same model ID and frees obsolete geometry", async () => {
  const disposed = [];
  state.load.mockImplementation(async (url) => ({
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
  }));
  const old = {
    id: "same",
    renderUrl: "/old",
    lodUrl: "/old",
    shadowUrl: "/old",
  };
  state.models = [old];
  const assets = modelAssets(() => {});
  await assets.ensure(new Set(["same"]), "render");
  const original = assets.model("same", "render");
  assets.replaceCatalogue([
    { ...old, renderUrl: "/new", lodUrl: "/new", shadowUrl: "/new" },
  ]);
  await assets.ensure(new Set(["same"]), "render");
  expect(assets.model("same", "render")).not.toBe(original);
  assets.prune();
  await Promise.resolve();
  expect(disposed).toEqual(["/old"]);
  assets.destroy();
  await Promise.resolve();
  expect(disposed).toEqual(["/old", "/new"]);
});
