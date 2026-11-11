import { Capacitor, registerPlugin } from '@capacitor/core'

export const isAndroid = Capacitor.getPlatform() === 'android'
export const nativeStore = registerPlugin('LocalStore')
let opening
let adapter

export async function openLocalDatabase() {
  if (adapter) return adapter
  if (opening) return opening
  opening = (async () => {
    if (isAndroid) {
      adapter = {
        async get(key) { const { value } = await nativeStore.get({ key }); return value == null ? null : JSON.parse(value) },
        async batch(changes) { await nativeStore.batch({ changes: changes.map(({ key, value }) => ({ key, value: value == null ? null : JSON.stringify(value) })) }) },
        async scan(prefix, after = '', limit = 250) {
          const { entries } = await nativeStore.scan({ prefix, after, limit })
          return entries.map(({ key, value }) => ({ key, value: JSON.parse(value) }))
        },
        clear: prefix => nativeStore.clear({ prefix }),
      }
    } else {
      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open('dndshare-local', 1)
        request.onupgradeneeded = () => request.result.createObjectStore('records')
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
      adapter = {
        get(key) { return new Promise((resolve, reject) => {
          const request = db.transaction('records').objectStore('records').get(key)
          request.onsuccess = () => resolve(request.result ?? null)
          request.onerror = () => reject(request.error)
        }) },
        batch(changes) { return new Promise((resolve, reject) => {
          const transaction = db.transaction('records', 'readwrite')
          const store = transaction.objectStore('records')
          for (const { key, value } of changes) { if (value == null) store.delete(key); else store.put(value, key) }
          transaction.oncomplete = () => resolve()
          transaction.onabort = transaction.onerror = () => reject(transaction.error || new Error('Локальная запись отменена'))
        }) },
        scan(prefix, after = '', limit = 250) { return new Promise((resolve, reject) => {
          const result = []
          const request = db.transaction('records').objectStore('records').openCursor(IDBKeyRange.bound(after || prefix, prefix + '\uffff', Boolean(after), false))
          request.onsuccess = () => {
            const cursor = request.result
            if (!cursor || result.length >= limit) return resolve(result)
            result.push({ key: cursor.key, value: cursor.value }); cursor.continue()
          }
          request.onerror = () => reject(request.error)
        }) },
        async clear(prefix) {
          let page
          do { page = await adapter.scan(prefix); await adapter.batch(page.map(({ key }) => ({ key, value: null }))) } while (page.length)
        },
      }
    }
    return adapter
  })().catch(error => { opening = null; throw error })
  return opening
}

export async function allLocalRecords(prefix) {
  const db = await openLocalDatabase()
  const entries = []
  let after = ''
  while (true) {
    const page = await db.scan(prefix, after)
    entries.push(...page)
    if (!page.length) return entries
    after = page.at(-1).key
  }
}
