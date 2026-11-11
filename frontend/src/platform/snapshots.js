import { applyDocumentPatches } from '../shared/lib/documentPatch'

export async function updateConfirmedSnapshot(db, scope, url, payload, init) {
  const character = url.pathname.match(/^\/api\/char\/([^/]+)\/(data|changes)$/)
  const map = url.pathname.match(/^(\/api\/(?:sessions\/[^/]+\/)?maps\/[^/]+)(?:\/changes)?$/)
  const resource = character ? `/api/char/${character[1]}` : map?.[1]
  if (!resource || !Number.isInteger(payload.version)) return
  const key = `${scope}http:${resource}`
  const saved = await db.get(key)
  if (!saved) return
  const snapshot = saved.payload
  const body = typeof init.body === 'string' ? JSON.parse(init.body) : null
  const previousVersion = snapshot.version ?? snapshot.revision
  const expected = payload.fromVersion ?? body?.baseVersion
  const current = character ? snapshot.data : Object.fromEntries(['name', 'document', 'state'].filter(key => key in snapshot).map(key => [key, snapshot[key]]))
  if (payload.version < previousVersion || (payload.data === undefined && expected !== previousVersion)) return
  const next = payload.data ?? applyDocumentPatches(current, payload.patches || body?.patches || [])
  const value = character
    ? { ...snapshot, ...payload.metadata, data: next, version: payload.version }
    : { ...snapshot, ...payload.metadata, ...next, revision: payload.version }
  await db.batch([{ key, value: { payload: value, time: Date.now() } }])
}
