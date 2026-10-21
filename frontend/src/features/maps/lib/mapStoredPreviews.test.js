import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  context: vi.fn(),
  upload: vi.fn(),
  snapshot: vi.fn(),
}));
vi.mock("@/shared/api/mapsApi", () => ({
  getMapPreviewContext: state.context,
  uploadMapPreview: state.upload,
}));
vi.mock("../rendering/mapSnapshots", () => ({
  requestMapSnapshot: state.snapshot,
}));
import { ensureStoredMapPreview } from "./mapStoredPreviews";
beforeEach(() => {
  vi.clearAllMocks();
  state.context.mockResolvedValue({
    document: { tiles: [] },
    models: [{ id: "current" }],
    signature: "new",
  });
  state.snapshot.mockResolvedValue(new Blob(["webp"]));
  state.upload.mockResolvedValue({ previewUrl: "/stored" });
});
it("uses stored URLs without loading models or running a renderer", async () => {
  expect(await ensureStoredMapPreview({ id: "ready", previewUrl: "/s3" })).toBe(
    "/s3",
  );
  expect(state.context).not.toHaveBeenCalled();
  expect(state.snapshot).not.toHaveBeenCalled();
});
it("deduplicates uploads and renders the current server catalogue", async () => {
  const m = { id: "map", previewSignature: "old" };
  const results = await Promise.all([
    ensureStoredMapPreview(m),
    ensureStoredMapPreview(m),
  ]);
  expect(results).toEqual(["/stored", "/stored"]);
  expect(state.snapshot).toHaveBeenCalledOnce();
  expect(state.snapshot).toHaveBeenCalledWith(
    { tiles: [] },
    expect.any(AbortSignal),
    {
      catalogue: [{ id: "current" }],
      key: "new",
    },
  );
  expect(state.upload).toHaveBeenCalledOnce();
});
it("keeps only the newest version of a map and never uploads an obsolete capture", async () => {
  let finish;
  state.context.mockResolvedValueOnce({
    document: {},
    models: [],
    signature: "old",
  });
  state.snapshot.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const old = ensureStoredMapPreview({ id: "latest", previewSignature: "old" });
  const cancelled = expect(old).rejects.toMatchObject({ name: "AbortError" });
  await vi.waitFor(() => expect(finish).toBeTypeOf("function"));
  const next = ensureStoredMapPreview({
    id: "latest",
    previewSignature: "new",
  });
  await cancelled;
  expect(await next).toBe("/stored");
  finish(new Blob(["obsolete"]));
  await Promise.resolve();
  expect(state.upload.mock.calls.map((call) => call[1])).toEqual(["new"]);
});
it("cancels work when its last observer leaves, but retains a shared card's request", async () => {
  let finish;
  state.context.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const controller = new AbortController();
  const first = ensureStoredMapPreview(
    { id: "shared" },
    { signal: controller.signal },
  );
  const cancelled = expect(first).rejects.toMatchObject({ name: "AbortError" });
  const second = ensureStoredMapPreview({ id: "shared" });
  const signal = state.context.mock.calls[0][1];
  controller.abort();
  await cancelled;
  expect(signal.aborted).toBe(false);
  finish({ document: {}, models: [], signature: "shared" });
  expect(await second).toBe("/stored");
  const leaving = new AbortController();
  state.context.mockImplementationOnce(() => new Promise(() => {}));
  const stopped = ensureStoredMapPreview(
    { id: "leaving" },
    { signal: leaving.signal },
  );
  const rejection = expect(stopped).rejects.toMatchObject({
    name: "AbortError",
  });
  leaving.abort();
  await rejection;
  expect(state.context.mock.calls.at(-1)[1].aborted).toBe(true);
});
it("refreshes stale URLs and reuses a preview published by another generator", async () => {
  state.context.mockResolvedValueOnce({ previewUrl: "/already-published" });
  expect(
    await ensureStoredMapPreview({
      id: "stale",
      previewUrl: "/old",
      previewStale: true,
    }),
  ).toBe("/already-published");
  expect(state.snapshot).not.toHaveBeenCalled();
  expect(state.upload).not.toHaveBeenCalled();
});
it("rebuilds a screenshot if the map changed during upload", async () => {
  state.upload.mockRejectedValueOnce(
    Object.assign(new Error("stale"), { status: 409 }),
  );
  state.context.mockResolvedValueOnce({
    document: {},
    models: [],
    signature: "old",
  });
  expect(await ensureStoredMapPreview({ id: "changing" })).toBe("/stored");
  expect(state.upload.mock.calls.map((c) => c[1])).toEqual(["old", "new"]);
});
it("uploads an editor snapshot with one request and fetches context only after a conflict", async () => {
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode("[]"),
  );
  const map = {
    id: "local",
    document: { tiles: [], objects: [] },
    previewSignature: "saved",
    previewModelsSignature: [...new Uint8Array(hash)]
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join(""),
  };
  expect(await ensureStoredMapPreview(map, { catalogue: [] })).toBe("/stored");
  expect(state.context).not.toHaveBeenCalled();
  expect(state.upload.mock.calls[0][1]).toBe("saved");
  state.upload.mockRejectedValueOnce(
    Object.assign(new Error("stale"), { status: 409 }),
  );
  expect(await ensureStoredMapPreview(map, { catalogue: [] })).toBe("/stored");
  expect(state.context).toHaveBeenCalledOnce();
  expect(state.upload.mock.calls.map((call) => call[1])).toEqual([
    "saved",
    "saved",
    "new",
  ]);
});
