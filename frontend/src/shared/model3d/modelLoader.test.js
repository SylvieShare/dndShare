import { expect, it, vi } from "vitest";
import { acquireModelLoader } from "./modelLoader";
const fake = vi.hoisted(() => ({
  decoders: [],
  loaders: [],
  init: vi.fn(async () => {}),
  fetch: vi.fn(async (url, options) => {
    options.onProgress?.({ loaded: 45, total: 100 });
    return url;
  }),
}));
vi.mock("./fetchModelResource", () => ({ fetchModelResource: fake.fetch }));
vi.mock("three/addons/loaders/KTX2Loader.js", () => ({
  KTX2Loader: class {
    constructor(manager) {
      this.manager = manager;
      this.dispose = vi.fn();
      fake.decoders.push(this);
    }
    init() {
      return fake.init(this.manager);
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
      this.parseAsync = vi.fn(async (data) => data);
      fake.loaders.push(this);
    }
    setMeshoptDecoder() {
      return this;
    }
    setKTX2Loader(decoder) {
      this.decoder = decoder;
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
  expect(loader.parseAsync).not.toHaveBeenCalled();
  expect(decoder.dispose).not.toHaveBeenCalled();
  start();
  expect(await pending).toBe("/queued.glb");
  expect(decoder.dispose).toHaveBeenCalledTimes(1);
  const next = acquireModelLoader({ format: "failure" }),
    failed = fake.decoders.at(-1);
  fake.loaders
    .at(-1)
    .parseAsync.mockRejectedValueOnce(new Error("invalid KTX2"));
  await expect(next.load("/broken.glb")).rejects.toThrow("invalid KTX2");
  next.release();
  expect(failed.dispose).toHaveBeenCalledTimes(1);
});

it("forwards byte progress from the GLB request to the download manager", async () => {
  const owner = acquireModelLoader({ format: "bytes" }),
    onProgress = vi.fn();
  await owner.load("/progress.glb", (fn) => fn(), onProgress);
  expect(onProgress).toHaveBeenCalledWith({ loaded: 45, total: 100 });
  owner.release();
});

it("replaces failed decoder initialization before a later retry instead of reusing a rejected decoder", async () => {
  const owner = acquireModelLoader({ format: "recover-decoder" }),
    loader = fake.loaders.at(-1),
    first = loader.decoder;
  loader.parseAsync.mockRejectedValueOnce(
    new Error("transcoder download failed"),
  );
  await expect(owner.load("/first.glb")).rejects.toMatchObject({
    stage: "decode",
    retryable: true,
  });
  expect(first.dispose).toHaveBeenCalledTimes(1);
  expect(loader.decoder).not.toBe(first);
  expect(await owner.load("/later.glb")).toBe("/later.glb");
  owner.release();
});

it("times out stalled decoder requests and makes the decode failure retryable", async () => {
  vi.useFakeTimers();
  const owner = acquireModelLoader({ format: "decoder-idle" }),
    loader = fake.loaders.at(-1);
  fake.init.mockImplementationOnce(
    (manager) =>
      new Promise((resolve, reject) =>
        manager.abortController.signal.addEventListener("abort", () =>
          reject(new DOMException("Aborted", "AbortError")),
        ),
      ),
  );
  loader.parseAsync.mockImplementationOnce(async (data) => {
    await loader.decoder.init();
    return data;
  });
  const failed = expect(owner.load("/stalled.glb")).rejects.toMatchObject({
    stage: "decode",
    retryable: true,
  });
  await vi.advanceTimersByTimeAsync(120000);
  await failed;
  owner.release();
  vi.useRealTimers();
});

it("retries every concurrent parse when their shared decoder times out", async () => {
  vi.useFakeTimers();
  const owner = acquireModelLoader({ format: "shared-decoder-idle" }),
    loader = fake.loaders.at(-1);
  fake.init.mockImplementation(
    (manager) =>
      new Promise((resolve, reject) =>
        manager.abortController.signal.addEventListener("abort", () =>
          reject(new DOMException("Aborted", "AbortError")),
        ),
      ),
  );
  loader.parseAsync.mockImplementation(async (data) => {
    await loader.decoder.init();
    return data;
  });
  const outcomes = Promise.allSettled([
    owner.load("/a.glb"),
    owner.load("/b.glb"),
  ]);
  await vi.advanceTimersByTimeAsync(120000);
  for (const result of await outcomes) {
    expect(result.status).toBe("rejected");
    expect(result.reason).toMatchObject({ stage: "decode", retryable: true });
  }
  owner.release();
  fake.init.mockImplementation(async () => {});
  vi.useRealTimers();
});
