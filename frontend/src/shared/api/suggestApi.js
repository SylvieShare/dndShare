import { fetchDelete, fetchGet, fetchPost, fetchPut } from '@/shared/api/http'

export const suggestApi = {
  types() {
    return fetchGet('/suggest/types')
  },
  list(typeId) {
    return fetchGet('/suggest/' + typeId)
  },
  batch(typeIds) {
    return fetchGet('/suggest/batch?typeIds=' + typeIds.join(','))
  },
  create(typeId, payload) {
    return fetchPost('/suggest/' + typeId, payload)
  },
  update(typeId, id, payload) {
    return fetchPut('/suggest/' + typeId + '/' + id, payload)
  },
  makeBase(typeId, id) {
    return fetchPost('/suggest/' + typeId + '/' + id + '/make-base', null)
  },
  delete(typeId, id) {
    return fetchDelete('/suggest/' + typeId + '/' + id)
  },
}
