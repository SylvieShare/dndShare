import { createDocumentSync } from '../shared/lib/documentSync'
import { hasActiveOutbox } from '../shared/lib/documentOutbox'
import { outboxStorage } from './journal'

function endpoint(key, account) {
  const prefix = 'dndshare.document-pending.v1.'
  if (!key.startsWith(prefix)) return null
  const name = key.slice(prefix.length).split(':queue:')[0]
  const character = name.match(/^character(?:-command)?:([^:]+):(.+)$/)
  if (character && character[1] === String(account)) return `/api/char/${encodeURIComponent(character[2])}/data`
  const map = name.match(/^([^:]+):map:(.+)$/)
  if (map && map[1] === String(account)) return `/api/maps/${encodeURIComponent(map[2])}`
  return null
}

export async function resumeLocalQueues(account, signal) {
  const storage = outboxStorage()
  await storage.refresh?.()
  const scopes = new Set(Array.from({ length: storage.length }, (_, index) => storage.key(index)?.split(':queue:')[0]).filter(Boolean))
  for (const key of scopes) {
    const url = endpoint(key, account)
    if (signal.aborted || !url || hasActiveOutbox(key)) continue
    let saved
    for (let index = 0; index < storage.length; index++) {
      const candidate = storage.key(index)
      if (candidate === key || candidate?.startsWith(key + ':queue:')) { saved = JSON.parse(storage.getItem(candidate)); break }
    }
    if (!saved) continue
    const request = async (path, options = {}) => {
      const response = await fetch(path, { ...options, signal, headers: { 'Content-Type': 'application/json' } })
      const payload = await response.json()
      if (!response.ok) throw Object.assign(new Error(payload.desc || 'Не удалось синхронизировать изменения'), { status: response.status })
      return payload
    }
    const sync = createDocumentSync({
      data: saved.base, version: saved.version, storageKey: key,
      send: packet => request(url, { method: 'PATCH', body: JSON.stringify(packet) }),
      load: version => request(`${url.replace(/\/data$/, '')}/changes?after=${version}`),
    })
    try { await sync.ready; await sync.flush() } finally { sync.stop() }
  }
}
