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
      for (const listener of listeners) listener();
    });
  }
  function drain() {
    while (active < limit && queue.length) {
      queue.sort((a, b) => b.priority() - a.priority());
      const job = queue.shift();
      job.state.status = "loading";
      active++;
      Promise.resolve()
        .then(job.run)
        .then(
          (value) => {
            job.state.status = "ready";
            job.resolve(value);
          },
          (error) => {
            job.state.status =
              error.name === "AbortError" ? "cancelled" : "failed";
            job.reject(error);
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
    schedule(key, run, priority, state) {
      return new Promise((resolve, reject) => {
        state.status = "queued";
        const job = { key, run, priority, state, resolve, reject };
        jobs.set(key, job);
        queue.push(job);
        drain();
      });
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
    get: (key) => jobs.get(key)?.state,
    remove(key) {
      const job = jobs.get(key);
      if (!job) return;
      jobs.delete(key);
      const index = queue.indexOf(job);
      if (index >= 0) {
        queue.splice(index, 1);
        job.state.status = "cancelled";
        job.reject(new DOMException("Cancelled", "AbortError"));
      }
      notify();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
export const modelDownloads = createModelDownloadManager();
