import { fetchGet, fetchPost } from './http'

export function getInteractions(uuid, sessionUuid, { peer, before } = {}) {
  const query = new URLSearchParams({ sessionUuid })
  if (peer) query.set('peer', peer)
  if (before) query.set('before', before)
  return fetchGet(`/char/${uuid}/interactions?${query}`)
}
export function createInteraction(uuid, request) {
  return fetchPost(`/char/${uuid}/interactions`, request)
}
export function resolveInteraction(uuid, eventId, decision) {
  return fetchPost(`/char/${uuid}/interactions/${eventId}/resolve`, { decision })
}
export function readMessages(uuid, sessionUuid, peerUuid, throughId) {
  return fetchPost(`/char/${uuid}/interactions/read`, { sessionUuid, peerUuid, throughId })
}
