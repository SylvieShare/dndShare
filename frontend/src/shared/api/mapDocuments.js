import {
  seedDocumentResource,
  writeDocumentResource,
  reloadDocumentResource,
  discardDocumentResource,
} from './documentResources'
import { canonicalMapData } from './mapDocumentData'
const config = (map, session) => ({
  canonicalize: canonicalMapData,
  key: session ? `session-map:${session}:${map.id}` : `map:${map.id}`,
  url: session
    ? `/sessions/${encodeURIComponent(session)}/maps/${encodeURIComponent(map.id)}`
    : `/maps/${encodeURIComponent(map.id)}`,
  fields: session ? ['name', 'document', 'state'] : ['name', 'document'],
})
export const seedMapDocument = (map, session, reset = false) =>
  seedDocumentResource(map, { ...config(map, session), reset })
export const writeMapDocument = (map, session) =>
  writeDocumentResource(map, config(map, session))
export const reloadMapDocument = (map, session) =>
  reloadDocumentResource(map, config(map, session))
export const discardMapDocument = (map, session) =>
  discardDocumentResource(config(map, session))
