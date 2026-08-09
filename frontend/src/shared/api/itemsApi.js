import { fetchDelete, fetchGet, fetchPost, fetchPut } from '@/shared/api/http'
import { contentScopeQuery } from '@/shared/api/contentSourcesApi'

export const itemsApi = {
  list(typeId, limit = 30, scope = {}) {
    return fetchGet(`/items?typeId=${typeId}&limit=${limit}${contentScopeQuery(scope.contentSources, scope.sourceVersionId)}`)
  },
  search(typeId, q, limit = 30, scope = {}) {
    return fetchGet(`/items/search?typeId=${typeId}&q=${encodeURIComponent(q)}&limit=${limit}${contentScopeQuery(scope.contentSources, scope.sourceVersionId)}`)
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
