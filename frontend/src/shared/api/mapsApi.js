import { fetchGet, fetchPost, fetchPut, fetchDelete } from "./http";
import { loadModelCatalogue, resetModelCatalogue } from "./mapModelCatalogue";
import { seedMapDocument, writeMapDocument } from "./mapDocuments";
export const getMaps = (scope = "own") =>
  fetchGet(`/maps?scope=${encodeURIComponent(scope)}`);
export const getMap = (id) =>
  fetchGet(`/maps/${encodeURIComponent(id)}`).then((map) =>
    seedMapDocument(map),
  );
export const copyMap = (id) =>
  fetchPost(`/maps/${encodeURIComponent(id)}/copy`, {}).then((map) =>
    seedMapDocument(map),
  );
export const publishMap = (id, revision) =>
  fetchPost(`/maps/${encodeURIComponent(id)}/publish`, { revision });
export const subscribeMap = (id, subscribed) =>
  subscribed
    ? fetchPut(`/maps/subscriptions/${encodeURIComponent(id)}`, {})
    : fetchDelete(`/maps/subscriptions/${encodeURIComponent(id)}`);
export const rateMap = (id, rating) =>
  rating
    ? fetchPut(`/maps/ratings/${encodeURIComponent(id)}`, { rating })
    : fetchDelete(`/maps/ratings/${encodeURIComponent(id)}`);
const runtimeModel = ({ id, uuid, ...model }) => ({
  ...model,
  id: uuid,
  definitionId: id,
});
const catalogueModels = (models) => models.map(runtimeModel);
export const getMapModels = loadModelCatalogue;
export const resetMapModels = resetModelCatalogue;
export const saveMap = (map) =>
  map.id
    ? writeMapDocument(map)
    : fetchPost("/maps", map).then((map) => seedMapDocument(map));
export const deleteMap = (id) => fetchDelete(`/maps/${id}`);
export const getSessionMaps = (uuid, reset = false) =>
  fetchGet(`/sessions/${uuid}/maps`).then((response) => ({
    ...response,
    maps: response.maps.map((map) => seedMapDocument(map, uuid, reset)),
  }));
export const addSessionMap = (uuid, mapId) =>
  fetchPost(`/sessions/${uuid}/maps`, { mapId }).then((map) =>
    seedMapDocument(map, uuid),
  );
export const saveSessionMap = (uuid, map) => writeMapDocument(map, uuid);
export const deleteSessionMap = (uuid, id) =>
  fetchDelete(`/sessions/${uuid}/maps/${id}`);
export const saveMapDisplay = (uuid, display) =>
  fetchPut(`/sessions/${uuid}/map-display`, display);
export const getPublicMap = (code) =>
  fetchGet(`/public/sessions/${encodeURIComponent(code)}/map`);

export async function saveMapModelMetadata(id, metadata) {
  const { id: uuid, definitionId: logicalId, ...fields } = metadata;
  const model = await fetchPut(`/maps/models/${encodeURIComponent(id)}`, {
    ...fields,
    id: logicalId,
    uuid,
  });
  resetMapModels();
  return runtimeModel(model);
}

export async function getMapPreviewContext(id, signal) {
  const context = await fetchGet(
    `/maps/${encodeURIComponent(id)}/preview-context`,
    { signal },
  );
  return { ...context, models: catalogueModels(context.models) };
}
export async function uploadMapPreview(id, signature, blob, signal) {
  const response = await fetch(
    `/api/maps/${encodeURIComponent(id)}/preview?signature=${encodeURIComponent(signature)}`,
    {
      method: "POST",
      headers: { "Content-Type": "image/webp" },
      body: blob,
      signal,
    },
  );
  if (!response.ok) {
    const error = new Error("Не удалось сохранить превью карты");
    error.status = response.status;
    throw error;
  }
  return response.json();
}

export async function uploadSessionMapImage(uuid, file, name, width) {
  const body = new FormData();
  body.append("file", file);
  const response = await fetch("/api/storage/images", { method: "POST", body });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.desc || "Не удалось загрузить изображение");
  }
  const uploaded = await response.json();
  return fetchPost(`/sessions/${uuid}/map-images`, {
    name,
    width,
    imageId: uploaded.upload_id,
  }).then((map) => seedMapDocument(map, uuid));
}
