import { fetchDelete, fetchGet, fetchPost, fetchPut } from '@/shared/api/http'

export const itemsApi = {
  list(typeId, limit = 30) {
    return fetchGet(`/items?typeId=${typeId}&limit=${limit}`)
  },
  search(typeId, q, limit = 30) {
    return fetchGet(`/items/search?typeId=${typeId}&q=${encodeURIComponent(q)}&limit=${limit}`)
  },
  byIds(ids) {
    return fetchGet('/items/by-ids?ids=' + ids.join(','))
  },
  create(payload) {
    return fetchPost('/items', payload)
  },
  update(id, payload) {
    return fetchPut('/items/' + id, payload)
  },
  makeBase(id) {
    return fetchPost('/items/' + id + '/make-base', null)
  },
  delete(id) {
    return fetchDelete('/items/' + id)
  },
}
