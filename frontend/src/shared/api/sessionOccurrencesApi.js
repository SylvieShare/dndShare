import { fetchGet, fetchPost, fetchPatch, fetchDeleteJson } from './http'

const path = uuid => `/sessions/${uuid}/occurrences`
export const getSessionOccurrences = uuid => fetchGet(path(uuid), { cache: 'no-store' })
export const createSessionOccurrence = (uuid, data) => fetchPost(path(uuid), data)
export const updateSessionOccurrence = (uuid, id, data) => fetchPatch(`${path(uuid)}/${id}`, data)
export const deleteSessionOccurrence = (uuid, id) => fetchDeleteJson(`${path(uuid)}/${id}`)
