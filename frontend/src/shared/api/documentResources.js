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
const content = (record, config) => {
  const data = Object.fromEntries(config.fields.map((field) => [field, record[field]]))
  return config.canonicalize ? config.canonicalize(data) : data
}

export async function seedDocumentResource(record, config) {
  const { key, url } = config
  const identity = scoped(key)
  let entry = documents.get(identity)
  if (!entry) {
    if (documents.size >= 16) {
      const idle = [...documents].find(([, entry]) => !entry.sync.pending && !entry.sync.recovering)
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
      data: content(record, config),
      canonicalize: config.canonicalize,
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
    if (config.reset) entry.sync.reset(content(record, config), record.revision)
    if (record.revision >= entry.sync.version)
      entry.record = copyDocument(record)
    entry.sync.receive({
      data: content(record, config),
      version: record.revision,
    })
  }
  await entry.sync.ready
  entry.versions.set(record.revision, copyDocument(content(record, config)))
  if (entry.sync.pending && record.owned !== false) void entry.sync.flush()
  const data = entry.sync.data, revision = entry.sync.version
  // A restored queue can return an optimistic DTO at the current version.
  // Its caller must diff against the snapshot it actually received.
  entry.versions.set(revision, copyDocument(data))
  return { ...record, ...data, revision }
}

export async function writeDocumentResource(record, config) {
  const { key, url } = config
  let entry = documents.get(scoped(key))
  if (!entry) {
    const snapshot = await fetchGet(`${url}/changes?after=-1`)
    if (snapshot.version !== record.revision)
      throw Object.assign(new Error('Документ изменился на сервере'), {
        status: 409,
      })
    await seedDocumentResource(
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
    documentDiff(previous, content(record, config)),
    config.canonicalize,
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
