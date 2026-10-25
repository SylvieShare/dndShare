import {
  seedDocumentResource,
  writeDocumentResource,
} from './documentResources'
import { fetchDelete, fetchGet, fetchPost } from './http'
const path = (uuid) => `/sessions/${uuid}/global-maps`
const config = (uuid, map) => ({
  key: `global-map:${uuid}:${map.id}`,
  url: `${path(uuid)}/${map.id}`,
  fields: ['name', 'routes'],
})
const seed = (uuid, map, reset = false) =>
  seedDocumentResource(map, { ...config(uuid, map), reset })
export const getGlobalMaps = (uuid, reset = false) =>
  fetchGet(path(uuid), { cache: 'no-store' }).then(async (response) => ({
    ...response,
    maps: await Promise.all(response.maps.map((map) => seed(uuid, map, reset))),
  }))
export const createGlobalMap = (uuid, data) =>
  fetchPost(path(uuid), data).then((map) => seed(uuid, map))
export const saveGlobalMap = (uuid, map) =>
  writeDocumentResource(map, config(uuid, map))
export const deleteGlobalMap = (uuid, id) => fetchDelete(`${path(uuid)}/${id}`)
export const activateGlobalMap = (uuid, id) =>
  fetchPost(`${path(uuid)}/${id}/activate`, {})
