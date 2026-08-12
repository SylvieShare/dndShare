import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchPatch } from './http'

describe('HTTP client', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('accepts an empty 204 response even when it is marked as JSON', async () => {
    const response = {
      ok: true,
      status: 204,
      headers: { get: () => 'application/json; charset=utf-8' },
      json: vi.fn(() => Promise.reject(new SyntaxError('Unexpected end of JSON input'))),
    }
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(response)))

    await expect(fetchPatch('/sessions/test/chapters/1/position', { x: 12, y: 24 }))
      .resolves.toEqual({})
    expect(response.json).not.toHaveBeenCalled()
  })
})
