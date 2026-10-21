import { fetchGet, fetchPatch } from './http'
import { createDocumentSync } from '../lib/documentSync'
import {
  copyDocument,
  documentDiff,
  rebaseDocumentChanges,
} from '../lib/documentPatch'
import { useAccountStore } from '@/stores/account'

const documents = new Map()
const actor = () => useAccountStore().user?.id
const scoped = (key) => `${actor() || 'anonymous'}:${key}`
const content = (record, fields) =>
  Object.fromEntries(fields.map((field) => [field, record[field]]))

export function seedDocumentResource(record, config) {
  const { key, url, fields } = config
  const identity = scoped(key)
  let entry = documents.get(identity)
  if (!entry) {
    if (documents.size >= 16) {
      const idle = [...documents].find(([, entry]) => !entry.sync.pending)
      if (idle) {
        idle[1].sync.stop()
        documents.delete(idle[0])
      }
    }
    entry = { record: copyDocument(record), versions: new Map(), sync: null }
    const remember = (response) => {
      entry.record = {
        ...entry.record,
        ...response.metadata,
        ...entry.sync.confirmed,
        revision: response.version,
      }
      entry.versions.set(response.version, entry.sync.confirmed)
      if (entry.versions.size > 16)
        entry.versions.delete(entry.versions.keys().next().value)
    }
    entry.sync = createDocumentSync({
      data: content(record, fields),
      version: record.revision,
      storageKey:
        actor() && record.owned !== false
          ? `dndshare.document-pending.v1.${identity}`
          : null,
      send: (packet) => fetchPatch(url, packet),
      load: (version) => fetchGet(`${url}/changes?after=${version}`),
      onAck: remember,
      onRemote: remember,
    })
    documents.set(identity, entry)
  } else {
    if (config.reset) entry.sync.reset(content(record, fields), record.revision)
    if (record.revision >= entry.sync.version)
      entry.record = copyDocument(record)
    entry.sync.receive({
      data: content(record, fields),
      version: record.revision,
    })
  }
  entry.versions.set(record.revision, copyDocument(content(record, fields)))
  if (entry.sync.pending && record.owned !== false) void entry.sync.flush()
  return { ...record, ...entry.sync.data, revision: entry.sync.version }
}

export async function writeDocumentResource(record, config) {
  const { key, url, fields } = config
  let entry = documents.get(scoped(key))
  if (!entry) {
    const snapshot = await fetchGet(`${url}/changes?after=-1`)
    if (snapshot.version !== record.revision)
      throw Object.assign(new Error('Документ изменился на сервере'), {
        status: 409,
      })
    seedDocumentResource(
      {
        ...record,
        ...snapshot.metadata,
        ...snapshot.data,
        revision: snapshot.version,
      },
      config,
    )
    entry = documents.get(scoped(key))
  }
  const previous = entry.versions.get(record.revision)
  if (!previous)
    throw Object.assign(
      new Error('Версия документа устарела; загрузите изменения'),
      { status: 409 },
    )
  const next = rebaseDocumentChanges(
    previous,
    entry.sync.data,
    documentDiff(previous, content(record, fields)),
  ).data
  entry.sync.edit(next, {}, { record: false })
  const wait = entry.sync.whenIdle()
  void entry.sync.retry()
  await wait
  return copyDocument(entry.record)
}

export async function reloadDocumentResource(record, config) {
  const snapshot = await fetchGet(`${config.url}/changes?after=-1`)
  if (snapshot.data === undefined) throw new Error('Сервер не вернул документ')
  return seedDocumentResource(
    {
      ...record,
      ...snapshot.metadata,
      ...snapshot.data,
      revision: snapshot.version,
    },
    { ...config, reset: true },
  )
}
export function discardDocumentResource(config) {
  const key = scoped(config.key),
    entry = documents.get(key)
  if (!entry) return
  entry.sync.reset(entry.sync.confirmed, entry.sync.version)
  entry.sync.stop()
  documents.delete(key)
}
