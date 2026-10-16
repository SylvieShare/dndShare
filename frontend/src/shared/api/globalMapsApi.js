import { fetchDelete, fetchGet, fetchPost, fetchPut } from './http'
const path = uuid => `/sessions/${uuid}/global-maps`
export const getGlobalMaps = uuid => fetchGet(path(uuid), { cache: 'no-store' })
export const createGlobalMap = (uuid, data) => fetchPost(path(uuid), data)
export const saveGlobalMap = (uuid, map) => fetchPut(`${path(uuid)}/${map.id}`, { name: map.name, routes: map.routes, revision: map.revision })
export const deleteGlobalMap = (uuid, id) => fetchDelete(`${path(uuid)}/${id}`)
export const activateGlobalMap = (uuid, id) => fetchPost(`${path(uuid)}/${id}/activate`, {})
