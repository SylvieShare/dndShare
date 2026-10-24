import { modelDownloads } from "@/features/maps/rendering/modelDownloadManager";
import { fetchModelResource } from "@/shared/model3d/fetchModelResource";
import { modelLoadError } from "@/shared/model3d/modelLoadError";
import { previewTask } from "@/features/maps/lib/previewTask";
let current,
  sequence = 0;
export const resetModelCatalogue = () => {
  current = null;
};
export function loadModelCatalogue(publicCode, { signal, onRequest } = {}) {
  signal?.throwIfAborted();
  let entry = publicCode ? null : current;
  if (!entry) {
    const url = publicCode
      ? `/api/public/sessions/${encodeURIComponent(publicCode)}/map-models`
      : "/api/maps/models";
    const key = `catalogue:${++sequence}`;
    entry = {
      refs: 0,
      pending: true,
      file: { url, key, kind: "catalogue", bytes: 0 },
    };
    if (!publicCode) current = entry;
    const state = {};
    entry.file.state = state;
    entry.promise = modelDownloads.schedule(
      key,
      async (attemptSignal) => {
        try {
          const data = await fetchModelResource(url, {
            signal: attemptSignal,
            json: true,
            onProgress: (event) => modelDownloads.progress(state, event),
          });
          if (
            !Array.isArray(data) ||
            data.some(
              (model) =>
                typeof model.id !== "string" || typeof model.uuid !== "string",
            )
          )
            throw modelLoadError(
              new Error("Ответ сервера не является каталогом моделей"),
              { url, stage: "catalogue" },
            );
          return data.map(({ id, uuid, ...model }) => ({
            ...model,
            id: uuid,
            definitionId: id,
          }));
        } catch (error) {
          throw modelLoadError(error, { key });
        }
      },
      () => 3,
      state,
      { retry: (error) => error.retryable === true },
    );
    entry.promise
      .finally(() => {
        entry.pending = false;
        if (current === entry) current = null;
      })
      .catch(() => {});
  }
  entry.refs++;
  onRequest?.(entry.file);
  return previewTask(entry.promise, signal).finally(() => {
    if (--entry.refs === 0) modelDownloads.remove(entry.file.key);
  });
}
