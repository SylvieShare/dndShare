import { fetchGet, fetchPost } from '@/shared/api/http'

export function getSessionEvents(uuid, { after = 0, limit = 50 } = {}) {
  const query = new URLSearchParams()
  if (after) query.set('after', String(after))
  query.set('limit', String(limit))
  return fetchGet(`/sessions/${uuid}/events?${query}`)
}

export function createSessionEvent(uuid, event) {
  return fetchPost(`/sessions/${uuid}/events`, event)
}
