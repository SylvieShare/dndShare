import { outboxStorage } from '../../platform/journal'
// Each editor owns a distinct record. Locks protect recovery, not the contents
// of another editor's queue. Closing a page releases its locks automatically.
const active = new Set()
export const hasActiveOutbox = scope => [...active].some(key => key.startsWith(`${scope}:queue:`))

function hold(key) {
  const locks = globalThis.navigator?.locks
  if (active.has(key)) return Promise.resolve(null)
  active.add(key)
  if (!locks) return Promise.resolve(() => active.delete(key))
  return new Promise((resolve, reject) => {
    locks.request(key, { ifAvailable: true }, lock => {
      if (!lock) { active.delete(key); resolve(null); return }
      return new Promise(release => resolve(() => { active.delete(key); release() }))
    }).catch(error => { active.delete(key); reject(error) })
  })
}

export function createDocumentOutbox(storageKey) {
  const queueId = crypto.randomUUID()
  let scope, recordKey, opening, release, recovered, closed = false
  let buffered, hasBuffered = false
  let transfer = Promise.resolve()
  const resolveScope = () => scope || (scope = typeof storageKey === 'function' ? storageKey() : storageKey)
  function keys() {
    const storage = outboxStorage()
    const result = []
    if (storage?.getItem(scope)) result.push(scope) // Transfer the previous single record once.
    for (let index = 0; index < (storage?.length || 0); index++) {
      const key = storage.key(index)
      if (key?.startsWith(`${scope}:queue:`) && key !== recordKey) result.push(key)
    }
    return result.sort()
  }
  async function open() {
    if (closed || !resolveScope()) return
    if (!opening) {
      recordKey = `${scope}:queue:${queueId}`
      opening = hold(recordKey).then(owner => { release = owner })
    }
    await opening
  }
  function writeNow(value) {
    if (!recordKey || closed) return
    const storage = outboxStorage()
    if (!storage) return
    if (value) storage.setItem(recordKey, JSON.stringify(value))
    else storage.removeItem(recordKey)
    // Only remove the recovered record after its replacement is durable.
    if (recovered?.adopted) {
      const previous = recovered
      transfer = transfer.then(async () => {
        await storage.flush?.()
        storage.removeItem(previous.key)
        await storage.flush?.()
        previous.release()
      })
      void transfer.catch(() => {})
      recovered = null
    }
    hasBuffered = false
  }
  function abandon() {
    recovered?.release()
    recovered = null
  }
  return {
    get available() { return !!resolveScope() },
    async read() {
      try {
        await open()
        await outboxStorage()?.refresh?.()
        if (closed || !scope || !release) return null
        if (recovered) return JSON.parse(outboxStorage()?.getItem(recovered.key) || 'null')
        const candidates = keys()
        if (candidates.length && globalThis.window && !globalThis.navigator?.locks)
          throw Object.assign(new Error('Не удалось безопасно восстановить правки. Обновите браузер; очередь сохранена в этом браузере.'), { status: 409 })
        for (const key of candidates) {
          if (active.has(key)) continue
          const owner = await hold(key)
          if (!owner) continue
          let saved
          try { saved = JSON.parse(outboxStorage()?.getItem(key) || 'null') }
          catch { owner(); continue }
          if (!saved) { owner(); continue }
          recovered = { key, release: owner, adopted: false }
          return saved
        }
        if (hasBuffered) writeNow(buffered)
      } catch (error) {
        if (error.status === 409) throw error
        if (outboxStorage()?.flush) throw Object.assign(new Error('Не удалось прочитать сохранённые изменения. Повторите попытку.'), { status: 507, cause: error })
        // Editing remains available when storage is unavailable.
      }
      return null
    },
    adopt() { if (recovered) recovered.adopted = true },
    discardRecovered() {
      if (recovered) outboxStorage()?.removeItem(recovered.key)
      abandon()
    },
    abandon,
    write(value) {
      if (closed) return
      buffered = value
      hasBuffered = true
      try {
        if (release) writeNow(value)
        else {
          void open().then(() => {
            if (hasBuffered) { try { writeNow(buffered) } catch { /* quota */ } }
          }).catch(() => {})
          writeNow(value)
        }
      } catch { /* The queue remains available in memory. */ }
    },
    flush() { const storage = outboxStorage(); return storage?.flush ? transfer.then(() => storage.flush()) : null },
    close() {
      try { if (hasBuffered) writeNow(buffered) } catch { /* quota */ }
      closed = true
      abandon()
      const storage = outboxStorage()
      if (storage?.flush) void transfer.then(() => storage.flush()).finally(() => { release?.(); void opening?.then(() => release?.()) }).catch(() => {})
      else { release?.(); void opening?.then(() => release?.()) }
    },
  }
}
