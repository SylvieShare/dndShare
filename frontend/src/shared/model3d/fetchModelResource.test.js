import { afterEach, expect, it, vi } from "vitest";
import { fetchModelResource } from "./fetchModelResource";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
it("reports transfer size, returns binary data and treats partial transfers as unavailable rather than missing", async () => {
  const progress = vi.fn();
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(new Uint8Array([1, 2, 3]), {
          headers: { "Content-Length": "3" },
        }),
    ),
  );
  expect(
    new Uint8Array(
      await fetchModelResource("/asset", { onProgress: progress, bytes: 3 }),
    ),
  ).toEqual(new Uint8Array([1, 2, 3]));
  expect(progress).toHaveBeenCalledWith({ loaded: 3, total: 3 });
  await expect(
    fetchModelResource("/asset", { bytes: 6 }),
  ).rejects.toMatchObject({
    name: "ModelLoadError",
    kind: "unavailable",
    retryable: true,
    stage: "download",
  });
});
it("distinguishes confirmed missing files and catalogue endpoint failures from network problems", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(JSON.stringify({ desc: "Not found" }), { status: 404 }),
    ),
  );
  await expect(fetchModelResource("/asset")).rejects.toMatchObject({
    kind: "file-missing",
    retryable: false,
    status: 404,
  });
  await expect(
    fetchModelResource("/models", { json: true }),
  ).rejects.toMatchObject({
    kind: "unavailable",
    stage: "catalogue",
    retryable: false,
  });
  fetch.mockRejectedValueOnce(new TypeError("Failed to fetch"));
  await expect(fetchModelResource("/asset")).rejects.toMatchObject({
    kind: "unavailable",
    retryable: true,
  });
});
it("retries idle timeouts but never retries cancellation by the owner", async () => {
  vi.useFakeTimers();
  vi.stubGlobal(
    "fetch",
    vi.fn(
      (url, { signal }) =>
        new Promise((resolve, reject) =>
          signal.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          ),
        ),
    ),
  );
  const timed = expect(
    fetchModelResource("/asset", { timeout: 30000 }),
  ).rejects.toMatchObject({ name: "ModelLoadError", retryable: true });
  await vi.advanceTimersByTimeAsync(30000);
  await timed;
  const controller = new AbortController();
  const cancelled = expect(
    fetchModelResource("/asset", { signal: controller.signal }),
  ).rejects.toMatchObject({ name: "AbortError" });
  controller.abort();
  await cancelled;
});
it("cancels a stalled response stream, including a response supplied by a service worker", async () => {
  vi.useFakeTimers();
  const cancel = vi.fn();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(new ReadableStream({ cancel }))),
  );
  const controller = new AbortController();
  const pending = expect(
    fetchModelResource("/slow", { signal: controller.signal }),
  ).rejects.toMatchObject({ name: "AbortError" });
  await vi.advanceTimersByTimeAsync(0);
  controller.abort();
  await pending;
  expect(cancel).toHaveBeenCalledOnce();
});
