import { useAccountStore } from '@/stores/account'
import { fetchGet, fetchPatch } from './http'
import { applyDocumentPatches } from '../lib/documentPatch'
import { createDocumentSync } from '../lib/documentSync'

const documents = new Map()

// DM character controls use the same versioned, retryable protocol as a sheet.
export async function patchCharacterData(uuid, updates, snapshot, { action = 'health' } = {}) {
  const actor = useAccountStore().user?.id
  const key = `${actor || 'anonymous'}:${uuid}`
  let sync = documents.get(key)
  if (!sync) {
    if (documents.size >= 16) {
      const idle = [...documents].find(([, value]) => !value.pending && !value.recovering)
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
  await sync.ready
  const operations = updates.map((update) => ({
    op: 'set',
    path: update.path.split('.'),
    value: update.value,
  }))
  sync.edit(applyDocumentPatches(sync.data, operations), { action })
  const wait = sync.whenIdle()
  void sync.flush()
  await wait
  return { version: sync.version, data: sync.data }
}
