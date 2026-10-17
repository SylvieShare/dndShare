import { modelDownloadProgress } from "./modelDownloadProgress";

// Completed cache entries never become history in a later batch.
export function createModelDownloadSession() {
  let files = new Map(),
    active = false,
    session = 0;
  return (plan, stateFor) => {
    const pending = plan.filter(
      (file) => stateFor(file.url)?.status !== "ready",
    );
    if (!active && pending.length) {
      files = new Map();
      active = true;
      session++;
    }
    if (active) {
      const planned = new Set(plan.map((file) => file.url));
      for (const [url] of files)
        if (!planned.has(url) && stateFor(url)?.status !== "ready")
          files.delete(url);
      for (const file of pending) files.set(file.url, file);
    }
    const result = modelDownloadProgress([...files.values()], stateFor);
    active = result.remaining > 0;
    return { ...result, session };
  };
}
