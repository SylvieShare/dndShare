export function createModelDownloadManager(limit = 3) {
  const jobs = new Map(),
    queue = [],
    listeners = new Set();
  let active = 0,
    notifying = false;
  function notify() {
    if (notifying) return;
    notifying = true;
    queueMicrotask(() => {
      notifying = false;
      for (const fn of listeners) fn();
    });
  }
  function enqueue(job) {
    job.state.status = "queued";
    queue.push(job);
    drain();
  }
  function drain() {
    while (active < limit && queue.length) {
      queue.sort((a, b) => b.priority() - a.priority());
      const job = queue.shift();
      if (job.removed) continue;
      const state = job.state;
      state.status = "loading";
      state.attempt = (state.attempt || 0) + 1;
      state.nextRetryAt = 0;
      job.controller = new AbortController();
      active++;
      Promise.resolve()
        .then(() => job.run(job.controller.signal))
        .then(
          (value) => {
            state.status = "ready";
            state.error = null;
            job.resolve(value);
          },
          (error) => {
            state.error = error;
            if (!job.removed && job.options.retry?.(error)) {
              const delay = Math.min(
                30000,
                1000 * 2 ** Math.min(state.attempt - 1, 5),
              );
              state.status = "retrying";
              state.loaded = 0;
              state.nextRetryAt = Date.now() + delay;
              job.timer = setTimeout(() => {
                job.timer = null;
                if (!job.removed) enqueue(job);
              }, delay);
            } else {
              state.status =
                error.name === "AbortError" ? "cancelled" : "failed";
              job.reject(error);
            }
          },
        )
        .finally(() => {
          active--;
          notify();
          drain();
        });
    }
    notify();
  }
  return {
    schedule(key, run, priority, state, options = {}) {
      const existing = jobs.get(key);
      if (
        existing &&
        ["queued", "loading", "processing", "retrying"].includes(
          existing.state.status,
        )
      )
        return existing.promise;
      const job = { key, run, priority, state, options };
      job.promise = new Promise((resolve, reject) =>
        Object.assign(job, { resolve, reject }),
      );
      jobs.set(key, job);
      enqueue(job);
      return job.promise;
    },
    progress(state, event) {
      state.loaded = Math.max(state.loaded || 0, event.loaded || 0);
      state.total = Math.max(state.total || 0, event.total || 0);
      if (state.total && state.loaded >= state.total)
        state.status = "processing";
      notify();
    },
    failed(state) {
      state.status = "failed";
      notify();
    },
    retry(key) {
      const job = jobs.get(key);
      if (job?.state.status !== "retrying") return;
      clearTimeout(job.timer);
      job.timer = null;
      enqueue(job);
    },
    get: (key) => jobs.get(key)?.state,
    remove(key) {
      const job = jobs.get(key);
      if (!job) return;
      jobs.delete(key);
      job.removed = true;
      clearTimeout(job.timer);
      job.controller?.abort();
      const index = queue.indexOf(job);
      if (index >= 0) queue.splice(index, 1);
      if (["queued", "retrying"].includes(job.state.status)) {
        job.state.status = "cancelled";
        job.reject(new DOMException("Cancelled", "AbortError"));
      }
      notify();
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}
export const modelDownloads = createModelDownloadManager();
