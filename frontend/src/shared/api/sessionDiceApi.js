import { fetchGet, fetchPost } from './http'

export const getKarmicScales = uuid => fetchGet(`/sessions/${uuid}/karmic-dice`)

export async function rollSessionD20(uuid, request) {
  try { return await fetchPost(`/sessions/${uuid}/d20`, request) }
  catch (error) {
    // A response may be lost after the transaction committed. Reuse the receipt.
    if (error.status && error.status < 500) throw error
    return fetchPost(`/sessions/${uuid}/d20`, request)
  }
}
