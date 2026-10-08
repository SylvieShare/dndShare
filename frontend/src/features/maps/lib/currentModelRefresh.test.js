import { afterEach, expect, it, vi } from "vitest";
import { startModelRefresh } from "./currentModelRefresh";
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
it("refreshes open maps, skips hidden pages and cancels in-flight application on disposal", async () => {
  vi.useFakeTimers();
  const doc = { hidden: false };
  vi.stubGlobal("window", { document: doc });
  const read = vi.fn().mockResolvedValue([{ id: "same", renderUrl: "/new" }]),
    apply = vi.fn();
  const stop = startModelRefresh(read, apply);
  await vi.advanceTimersByTimeAsync(30000);
  expect(apply).toHaveBeenCalledWith([{ id: "same", renderUrl: "/new" }]);
  doc.hidden = true;
  await vi.advanceTimersByTimeAsync(30000);
  expect(read).toHaveBeenCalledOnce();
  doc.hidden = false;
  let resolve;
  read.mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  await vi.advanceTimersByTimeAsync(30000);
  stop();
  resolve([]);
  await Promise.resolve();
  expect(apply).toHaveBeenCalledOnce();
});
