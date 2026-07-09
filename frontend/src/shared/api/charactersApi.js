import { fetchDelete, fetchGet, fetchPatch, fetchPost, fetchPut } from '@/shared/api/http'

export const charactersApi = {
  list() {
    return fetchGet('/chars')
  },
  get(uuid) {
    return fetchGet('/char/' + uuid)
  },
  create(payload) {
    return fetchPost('/char', payload)
  },
  update(uuid, payload) {
    return fetchPut('/char/' + uuid, payload)
  },
  patchData(uuid, updates) {
    return fetchPatch('/char/' + uuid + '/data-patch', { updates })
  },
  delete(uuid) {
    return fetchDelete('/char/' + uuid)
  },
}
