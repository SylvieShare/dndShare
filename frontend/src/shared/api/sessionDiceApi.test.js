import { afterEach, expect, it, vi } from 'vitest'
import { rollSessionD20 } from './sessionDiceApi'
afterEach(() => vi.unstubAllGlobals())

it('retries a lost response with exactly the same receipt request', async () => {
  const fetch = vi.fn().mockRejectedValueOnce(new TypeError('network')).mockResolvedValueOnce({ ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => ({ rolls: [7] }) })
  vi.stubGlobal('fetch', fetch)
  const request = { requestId: 'receipt', kind: 'attack', mode: 'normal' }
  expect(await rollSessionD20('game', request)).toEqual({ rolls: [7] })
  expect(fetch.mock.calls[0]).toEqual(fetch.mock.calls[1])
})

it('does not retry access and validation failures', async () => {
  const fetch = vi.fn().mockResolvedValue({ ok: false, status: 403, json: async () => ({ desc: 'Forbidden' }) })
  vi.stubGlobal('fetch', fetch)
  await expect(rollSessionD20('game', {})).rejects.toMatchObject({ status: 403 })
  expect(fetch).toHaveBeenCalledTimes(1)
})
