import { expect, it, vi } from "vitest";
import { createModelDownloadManager } from "./modelDownloadManager";
const flush = async () => {
  for (let i = 0; i < 16; i++) await Promise.resolve();
};
it("limits active work to three and takes the highest current priority next", async () => {
  const manager = createModelDownloadManager(),
    started = [],
    finish = new Map();
  let active = 0,
    maximum = 0;
  const work = (key, priority = 0) =>
    manager.schedule(
      key,
      () => {
        started.push(key);
        active++;
        maximum = Math.max(maximum, active);
        return new Promise((resolve) =>
          finish.set(key, () => {
            active--;
            resolve(key);
          }),
        );
      },
      priority instanceof Function ? priority : () => priority,
      {},
    );
  const first = [work("a"), work("b"), work("c")];
  let priority = -1;
  const queued = [
    work("shadow", -1),
    work("preview", () => priority),
    work("lod", 1),
  ];
  await flush();
  expect(started).toEqual(["a", "b", "c"]);
  expect(manager.get("lod").status).toBe("queued");
  priority = 2;
  finish.get("a")();
  await flush();
  expect(started.at(-1)).toBe("preview");
  finish.get("b")();
  await flush();
  expect(started.at(-1)).toBe("lod");
  finish.get("c")();
  await flush();
  expect(started.at(-1)).toBe("shadow");
  for (const key of ["preview", "lod", "shadow"]) finish.get(key)();
  await Promise.all([...first, ...queued]);
  expect(maximum).toBe(3);
});
it("cancels unused queued work immediately and safely forgets a running request", async () => {
  const manager = createModelDownloadManager(1),
    queuedRun = vi.fn(),
    state = {};
  let finish;
  const running = manager.schedule(
    "a",
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
    () => 0,
    state,
  );
  const queued = manager.schedule("b", queuedRun, () => 0, {});
  const cancelled = expect(queued).rejects.toMatchObject({
    name: "AbortError",
  });
  manager.remove("b");
  await cancelled;
  await flush();
  expect(manager.get("b")).toBeUndefined();
  expect(queuedRun).not.toHaveBeenCalled();
  manager.remove("a");
  manager.progress(state, { loaded: 200, total: 200 });
  expect(manager.get("a")).toBeUndefined();
  finish();
  await running;
});
it("reports received bytes and keeps preparation visible until decoding finishes", async () => {
  const manager = createModelDownloadManager(),
    observer = vi.fn(),
    state = {};
  const stop = manager.subscribe(observer);
  let finish;
  const pending = manager.schedule(
    "model",
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
    () => 0,
    state,
  );
  await flush();
  manager.progress(state, { loaded: 40, total: 100 });
  expect(state).toMatchObject({ status: "loading", loaded: 40, total: 100 });
  manager.progress(state, { loaded: 100, total: 100 });
  expect(state.status).toBe("processing");
  finish();
  await pending;
  await flush();
  expect(state.status).toBe("ready");
  expect(observer).toHaveBeenCalled();
  stop();
  observer.mockClear();
  manager.remove("model");
  await flush();
  expect(observer).not.toHaveBeenCalled();
});
it("a failure releases the queue slot for the next file", async () => {
  const manager = createModelDownloadManager(1);
  const failed = manager.schedule(
    "bad",
    async () => {
      throw new Error("broken");
    },
    () => 0,
    {},
  );
  const next = manager.schedule(
    "next",
    async () => "ok",
    () => 0,
    {},
  );
  await expect(failed).rejects.toThrow("broken");
  await expect(next).resolves.toBe("ok");
  expect(manager.get("bad").status).toBe("failed");
});
