// Stop waiting without cancelling model downloads shared with the editor.
export function previewTask(task, signal) {
  if (!signal) return task;
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason);
    signal.addEventListener("abort", abort, { once: true });
    Promise.resolve(task)
      .then(resolve, reject)
      .finally(() => signal.removeEventListener("abort", abort));
    if (signal.aborted) abort();
  });
}
