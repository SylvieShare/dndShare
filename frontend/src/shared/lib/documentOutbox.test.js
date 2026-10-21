import { expect, it, vi } from 'vitest'
import { createDocumentOutbox } from './documentOutbox'
it('binds a late-resolved storage key to its original account', () => {
  const storage = new Map()
  vi.stubGlobal('localStorage', {
    getItem: (key) => storage.get(key),
    setItem: (key, value) => storage.set(key, value),
    removeItem: (key) => storage.delete(key),
  })
  let account = null
  const outbox = createDocumentOutbox(() => account && `account:${account}`)
  expect(outbox.read()).toBeNull()
  account = 1
  outbox.write({ pending: true })
  account = 2
  outbox.write({ pending: 'original actor' })
  expect(storage.has('account:2')).toBe(false)
  expect(JSON.parse(storage.get('account:1'))).toEqual({
    pending: 'original actor',
  })
  vi.unstubAllGlobals()
})
