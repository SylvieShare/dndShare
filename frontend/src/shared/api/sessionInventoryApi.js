import { fetchGet, fetchPost, fetchDeleteJson } from './http'
export const getSessionInventory = uuid => fetchGet(`/sessions/${uuid}/inventory`)
export const addSessionInventory = (uuid, request) => fetchPost(`/sessions/${uuid}/inventory`, request)
export const deleteSessionInventory = (uuid, id) => fetchDeleteJson(`/sessions/${uuid}/inventory/${id}`)
export const sendSessionInventory = (uuid, id, request) => fetchPost(`/sessions/${uuid}/inventory/${id}/transfer`, request)
