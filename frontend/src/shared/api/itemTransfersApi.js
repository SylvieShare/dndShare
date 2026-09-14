import { fetchGet, fetchPost } from './http'

export function getItemTransfers(uuid) {
  return fetchGet(`/char/${uuid}/item-transfers`)
}
export function createItemTransfer(uuid, request) {
  return fetchPost(`/char/${uuid}/item-transfers`, request)
}
export function resolveItemTransfer(uuid, id, decision) {
  return fetchPost(`/char/${uuid}/item-transfers/${id}/resolve`, { decision })
}

export function approveSessionTransfer(uuid, eventId) {
  return fetchPost(`/sessions/${uuid}/events/${eventId}/approve`, {})
}

export function getApplicationTargets(uuid) { return fetchGet(`/sessions/${uuid}/application-targets`) }
export function resolveSessionApplication(uuid, eventId, decision, target = {}) { return fetchPost(`/sessions/${uuid}/events/${eventId}/application`, { decision, target }) }
