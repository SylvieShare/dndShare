import { useAccountStore } from '@/stores/account'
import { fetchGet, fetchPatch } from './http'
import { applyDocumentPatches } from '../lib/documentPatch'
import { createDocumentSync } from '../lib/documentSync'

const documents = new Map()

// DM health controls use the same versioned, retryable protocol as a sheet.
export async function patchCharacterData(uuid, updates, snapshot) {
  const actor = useAccountStore().user?.id
  const key = `${actor || 'anonymous'}:${uuid}`
  let sync = documents.get(key)
  if (!sync) {
    if (documents.size >= 16) {
      const idle = [...documents].find(([, value]) => !value.pending)
      if (idle) {
        idle[1].stop()
        documents.delete(idle[0])
      }
    }
    sync = createDocumentSync({
      data: snapshot.data,
      version: snapshot.version,
      storageKey: actor
        ? `dndshare.document-pending.v1.character-command:${key}`
        : null,
      send: (packet) => fetchPatch(`/char/${uuid}/data`, packet),
      load: (version) => fetchGet(`/char/${uuid}/changes?after=${version}`),
    })
    documents.set(key, sync)
  } else if (snapshot.version > sync.version)
    sync.receive({ data: snapshot.data, version: snapshot.version })
  const operations = updates.map((update) => ({
    op: 'set',
    path: update.path.split('.'),
    value: update.value,
  }))
  sync.edit(applyDocumentPatches(sync.data, operations), { action: 'health' })
  const wait = sync.whenIdle()
  void sync.flush()
  await wait
  return { version: sync.version }
}
