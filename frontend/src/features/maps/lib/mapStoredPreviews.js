import { getMapPreviewContext, uploadMapPreview } from "@/shared/api/mapsApi";
import { requestMapSnapshot } from "../rendering/mapSnapshots";
import { previewTask } from "./previewTask";
const pending = new Map();
export function ensureStoredMapPreview(map, { signal } = {}) {
  if (signal?.aborted) return Promise.reject(signal.reason);
  let job = pending.get(map.id);
  if (job && job.signature !== map.previewSignature) {
    job.controller.abort();
    job = null;
  }
  if (map.previewUrl && !map.previewStale)
    return Promise.resolve(map.previewUrl);
  if (!job || job.controller.signal.aborted) {
    job = {
      signature: map.previewSignature,
      controller: new AbortController(),
      users: 0,
    };
    const current = job;
    job.promise = previewTask(
      generate(map.id, job.controller.signal),
      job.controller.signal,
    ).finally(() => {
      if (pending.get(map.id) === current) pending.delete(map.id);
    });
    pending.set(map.id, job);
  }
  job.users++;
  return previewTask(job.promise, signal).finally(() => {
    if (!--job.users) job.controller.abort();
  });
}
async function generate(id, signal) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const context = await getMapPreviewContext(id, signal);
    signal.throwIfAborted();
    if (context.previewUrl) return context.previewUrl;
    const blob = await requestMapSnapshot(context.document, signal, {
      catalogue: context.models,
      key: context.signature,
    });
    signal.throwIfAborted();
    try {
      return (await uploadMapPreview(id, context.signature, blob, signal))
        .previewUrl;
    } catch (error) {
      if (error.status !== 409 || attempt === 1) throw error;
    }
  }
}
