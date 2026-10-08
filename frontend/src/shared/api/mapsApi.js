import { fetchGet, fetchPost, fetchPut, fetchDelete } from "./http";
export const getMaps = () => fetchGet("/maps");
let modelCatalogue;
const runtimeModel = ({ id, uuid, ...model }) => ({
  ...model,
  id: uuid,
  definitionId: id,
});
const catalogueModels = (models) => models.map(runtimeModel);
export function getMapModels(publicCode) {
  if (publicCode)
    return fetchGet(
      `/public/sessions/${encodeURIComponent(publicCode)}/map-models`,
    ).then(catalogueModels);
  if (!modelCatalogue)
    modelCatalogue = fetchGet("/maps/models")
      .then(catalogueModels)
      .catch((error) => {
        modelCatalogue = null;
        throw error;
      });
  const pending = modelCatalogue;
  pending
    .finally(() => {
      if (modelCatalogue === pending) modelCatalogue = null;
    })
    .catch(() => {});
  return pending;
}
export const resetMapModels = () => {
  modelCatalogue = null;
};
export const saveMap = (map) =>
  map.id && !map.system
    ? fetchPut(`/maps/${map.id}`, map)
    : fetchPost("/maps", map);
export const deleteMap = (id) => fetchDelete(`/maps/${id}`);
export const getSessionMaps = (uuid) => fetchGet(`/sessions/${uuid}/maps`);
export const addSessionMap = (uuid, mapId) =>
  fetchPost(`/sessions/${uuid}/maps`, { mapId });
export const saveSessionMap = (uuid, map) =>
  fetchPut(`/sessions/${uuid}/maps/${map.id}`, {
    revision: map.revision,
    state: map.state,
  });
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

export async function getMapPreviewContext(id) {
  const context = await fetchGet(
    `/maps/${encodeURIComponent(id)}/preview-context`,
  );
  return { ...context, models: catalogueModels(context.models) };
}
export async function uploadMapPreview(id, signature, blob) {
  const response = await fetch(
    `/api/maps/${encodeURIComponent(id)}/preview?signature=${encodeURIComponent(signature)}`,
    {
      method: "POST",
      headers: { "Content-Type": "image/webp" },
      body: blob,
    },
  );
  if (!response.ok) {
    const error = new Error("Не удалось сохранить превью карты");
    error.status = response.status;
    throw error;
  }
  return response.json();
}
