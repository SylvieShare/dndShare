import { onBeforeUnmount, onMounted, ref } from 'vue';

// Events invalidate durable REST state. Reconnection always catches up; polling
// only covers disconnected streams and a slow consistency check.
export function useMapSync(url, refresh) {
  const connected = ref(false);
  let stream,
    timer,
    closed = false,
    busy = false,
    queued = false,
    failures = 0;
  async function sync() {
    if (closed) return;
    if (busy) {
      queued = true;
      return;
    }
    busy = true;
    try {
      await refresh();
      failures = 0;
    } catch {
      failures++;
    } finally {
      busy = false;
      clearTimeout(timer);
      if (!closed) {
        if (queued) {
          queued = false;
          timer = setTimeout(sync, 100);
        } else
          timer = setTimeout(
            sync,
            connected.value && !failures
              ? 45000
              : Math.min(30000, 2000 * 2 ** Math.min(failures, 4)),
          );
      }
    }
  }
  function visible() {
    if (document.visibilityState === 'visible') sync();
  }
  onMounted(() => {
    sync();
    if (typeof EventSource !== 'undefined') {
      stream = new EventSource(url);
      stream.onopen = () => {
        connected.value = true;
        sync();
      };
      stream.onmessage = sync;
      stream.onerror = () => {
        connected.value = false;
        clearTimeout(timer);
        timer = setTimeout(sync, 2000);
      };
    }
    document.addEventListener('visibilitychange', visible);
  });
  onBeforeUnmount(() => {
    closed = true;
    clearTimeout(timer);
    stream?.close();
    document.removeEventListener('visibilitychange', visible);
  });
  return { connected, refresh: sync };
}
