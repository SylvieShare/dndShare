import { expect, it, vi } from "vitest";
import { acquireModelLoader } from "./modelLoader";
const fake = vi.hoisted(() => ({ decoders: [], loaders: [] }));
vi.mock("three/addons/loaders/KTX2Loader.js", () => ({
  KTX2Loader: class {
    constructor() {
      this.dispose = vi.fn();
      fake.decoders.push(this);
    }
    setWorkerLimit() {
      return this;
    }
    detectSupport(renderer) {
      this.workerConfig = { format: renderer.format };
      return this;
    }
  },
}));
vi.mock("three/addons/loaders/GLTFLoader.js", () => ({
  GLTFLoader: class {
    constructor() {
      this.loadAsync = vi.fn(async (url) => url);
      fake.loaders.push(this);
    }
    setMeshoptDecoder() {
      return this;
    }
    setKTX2Loader() {
      return this;
    }
  },
}));
it("shares decoding across compatible canvases and releases it only after the last owner", () => {
  const a = acquireModelLoader({ format: "astc" }),
    b = acquireModelLoader({ format: "astc" }),
    c = acquireModelLoader({ format: "etc2" });
  expect(a.key).toBe(b.key);
  expect(a.key).not.toBe(c.key);
  const [shared, redundant, other] = fake.decoders.slice(-3);
  expect(redundant.dispose).toHaveBeenCalledTimes(1);
  a.release();
  a.release();
  expect(shared.dispose).not.toHaveBeenCalled();
  b.release();
  c.release();
  expect(shared.dispose).toHaveBeenCalledTimes(1);
  expect(other.dispose).toHaveBeenCalledTimes(1);
});
it("keeps the decoder alive for a queued model when its canvas closes, including a failed decode", async () => {
  const owner = acquireModelLoader({ format: "queued" }),
    decoder = fake.decoders.at(-1),
    loader = fake.loaders.at(-1);
  let start;
  const pending = owner.load(
    "/queued.glb",
    (fn) =>
      new Promise((resolve) => {
        start = () => resolve(fn());
      }),
  );
  owner.release();
  expect(loader.loadAsync).not.toHaveBeenCalled();
  expect(decoder.dispose).not.toHaveBeenCalled();
  start();
  expect(await pending).toBe("/queued.glb");
  expect(decoder.dispose).toHaveBeenCalledTimes(1);
  const next = acquireModelLoader({ format: "failure" }),
    failed = fake.decoders.at(-1);
  fake.loaders
    .at(-1)
    .loadAsync.mockRejectedValueOnce(new Error("invalid KTX2"));
  await expect(next.load("/broken.glb")).rejects.toThrow("invalid KTX2");
  next.release();
  expect(failed.dispose).toHaveBeenCalledTimes(1);
});
