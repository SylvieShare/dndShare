import { fetchGet, fetchPost, fetchPut, fetchDelete } from './http'
export const getMaps = () => fetchGet('/maps')
export const saveMap = (map) =>
  map.id && !map.system ? fetchPut(`/maps/${map.id}`, map) : fetchPost('/maps', map)
export const deleteMap = (id) => fetchDelete(`/maps/${id}`)
export const getSessionMaps = (uuid) => fetchGet(`/sessions/${uuid}/maps`)
export const addSessionMap = (uuid, mapId) => fetchPost(`/sessions/${uuid}/maps`, { mapId })
export const saveSessionMap = (uuid, map) =>
  fetchPut(`/sessions/${uuid}/maps/${map.id}`, { revision: map.revision, state: map.state })
export const deleteSessionMap = (uuid, id) => fetchDelete(`/sessions/${uuid}/maps/${id}`)
export const saveMapDisplay = (uuid, display) => fetchPut(`/sessions/${uuid}/map-display`, display)
export const getPublicMap = (code) => fetchGet(`/public/sessions/${encodeURIComponent(code)}/map`)
