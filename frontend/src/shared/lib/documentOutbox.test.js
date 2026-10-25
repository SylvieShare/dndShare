import { expect, it, vi } from 'vitest'
import { createDocumentOutbox } from './documentOutbox'
it('binds a late-resolved storage key to its original account', async () => {
  const storage = new Map()
  vi.stubGlobal('localStorage', {
    getItem: (key) => storage.get(key),
    setItem: (key, value) => storage.set(key, value),
    removeItem: (key) => storage.delete(key),
  })
  let account = null
  const outbox = createDocumentOutbox(() => account && `account:${account}`)
  expect(await outbox.read()).toBeNull()
  account = 1
  outbox.write({ pending: true })
  account = 2
  outbox.write({ pending: 'original actor' })
  expect(storage.has('account:2')).toBe(false)
  const record = [...storage.keys()].find(key => key.startsWith('account:1:queue:'))
  expect(JSON.parse(storage.get(record))).toEqual({
    pending: 'original actor',
  })
  outbox.close()
  vi.unstubAllGlobals()
})
