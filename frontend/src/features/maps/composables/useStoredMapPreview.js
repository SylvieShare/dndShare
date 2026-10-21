import { onScopeDispose, shallowRef, watch } from "vue";

export function useStoredMapPreview({
  source,
  catalogue,
  session,
  journal,
  gesturing,
  loadingModels,
  saving,
  conflict,
}) {
  const saved = shallowRef(source);
  let timer, controller;
  function cancel() {
    clearTimeout(timer);
    controller?.abort();
  }
  watch(
    [
      saved,
      journal.revision,
      journal.dirty,
      gesturing,
      loadingModels,
      saving,
      conflict,
    ],
    () => {
      cancel();
      const map = saved.value;
      if (
        session ||
        !map?.id ||
        map.owned === false ||
        (map.previewUrl && !map.previewStale) ||
        journal.dirty.value ||
        gesturing.value ||
        loadingModels.value ||
        saving.value ||
        conflict.value
      )
        return;
      timer = setTimeout(async () => {
        const request = new AbortController();
        controller = request;
        try {
          const { ensureStoredMapPreview } = await import(
            "../lib/mapStoredPreviews"
          );
          request.signal.throwIfAborted();
          await ensureStoredMapPreview(map, {
            signal: request.signal,
            catalogue: catalogue.value,
          });
        } catch {
          // A missing preview retries on the next save or library visit.
        }
      }, 8000);
    },
    { immediate: true, flush: "sync" },
  );
  onScopeDispose(cancel);
  return {
    saved: (map) => {
      saved.value = map;
    },
  };
}
