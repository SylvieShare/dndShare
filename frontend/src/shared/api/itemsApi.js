import { fetchDelete, fetchGet, fetchPost, fetchPut } from '@/shared/api/http'
import { contentScopeQuery } from '@/shared/api/contentSourcesApi'

const MAX_ITEMS_PAGE_SIZE = 500

export const itemsApi = {
  list(typeId, limit = 30, scope = {}) {
    return fetchGet(`/items?typeId=${typeId}&limit=${limit}${contentScopeQuery(scope.contentSources, scope.sourceVersionId)}`)
  },
  search(typeId, q, limit = 30, scope = {}) {
    return fetchGet(`/items/search?typeId=${typeId}&q=${encodeURIComponent(q)}&limit=${limit}${contentScopeQuery(scope.contentSources, scope.sourceVersionId)}`)
  },
  async listAll(typeId, scope = {}, filters = {}) {
    const filterQuery = Object.keys(filters).length
      ? `&filters=${encodeURIComponent(JSON.stringify(filters))}`
      : ''
    const scopeQuery = contentScopeQuery(scope.contentSources, scope.sourceVersionId)
    const items = []

    while (true) {
      const response = await fetchGet(`/items?typeId=${typeId}&limit=${MAX_ITEMS_PAGE_SIZE}&offset=${items.length}${filterQuery}${scopeQuery}`)
      const page = response?.items || []
      items.push(...page)
      if (page.length < MAX_ITEMS_PAGE_SIZE) break
    }

    return { items }
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
  async uploadIconImage(id, file) {
    const form = new FormData()
    form.append('file', file)
    const response = await fetch(`/api/items/${id}/icon-image`, { method: 'POST', body: form })
    if (!response.ok) throw new Error(String(response.status))
    return response.json()
  },
  clearIcon(id) {
    return fetchDelete('/items/' + id + '/icon')
  },
  makeBase(id) {
    return fetchPost('/items/' + id + '/make-base', null)
  },
  delete(id) {
    return fetchDelete('/items/' + id)
  },
}
