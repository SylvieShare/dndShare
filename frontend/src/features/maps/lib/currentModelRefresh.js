// Open maps follow catalogue publications without storing an asset version.
export function startModelRefresh(read, apply) {
  let stopped = false,
    busy = false;
  const timer = setInterval(async () => {
    if (stopped || busy || window.document.hidden) return;
    busy = true;
    try {
      const models = await read();
      if (!stopped && models) await apply(models);
    } catch {
      // A temporary network failure is retried at the next interval.
    } finally {
      busy = false;
    }
  }, 30000);
  return () => {
    stopped = true;
    clearInterval(timer);
  };
}
