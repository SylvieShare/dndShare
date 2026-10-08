import { getMapPreviewContext, uploadMapPreview } from "@/shared/api/mapsApi";
import { requestMapSnapshot } from "../rendering/mapSnapshots";
const pending = new Map();
export function ensureStoredMapPreview(map) {
  if (map.previewUrl) return Promise.resolve(map.previewUrl);
  const key = `${map.id}:${map.previewSignature}`;
  if (pending.has(key)) return pending.get(key);
  const task = generate(map.id).finally(() => pending.delete(key));
  pending.set(key, task);
  return task;
}
async function generate(id) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const context = await getMapPreviewContext(id);
    const blob = await requestMapSnapshot(context.document, undefined, {
      catalogue: context.models,
      key: context.signature,
    });
    try {
      return (await uploadMapPreview(id, context.signature, blob)).previewUrl;
    } catch (error) {
      if (error.status !== 409 || attempt === 1) throw error;
    }
  }
}
