import { describe, expect, it } from 'vitest'
import { resolveMobileBackTarget } from './mobileBack'

describe('mobile header parent navigation', () => {
  it('returns the configured parent instead of browser history', () => {
    expect(resolveMobileBackTarget({
      name: 'Session',
      meta: { mobileBackTo: { name: 'Sessions' } },
      query: {},
    })).toEqual({ name: 'Sessions' })
  })

  it('does not show back on a root list route', () => {
    expect(resolveMobileBackTarget({ name: 'Sessions', meta: {}, query: {} })).toBeNull()
  })

  it('moves through handbook query nesting before leaving the route', () => {
    expect(resolveMobileBackTarget({
      name: 'Handbook',
      meta: {},
      query: { type: '6', item: '42', q: 'dragon' },
    })).toEqual({ name: 'Handbook', query: { type: '6', q: 'dragon' } })

    expect(resolveMobileBackTarget({
      name: 'Handbook',
      meta: {},
      query: { type: '6', q: 'dragon' },
    })).toEqual({ name: 'Handbook', query: {} })
  })

  it('can build a dynamic parent from current params', () => {
    const route = {
      name: 'CharacterPrint',
      params: { uuid: 'char-1' },
      query: {},
      meta: { mobileBackTo: current => ({ name: 'Character', params: { uuid: current.params.uuid } }) },
    }
    expect(resolveMobileBackTarget(route)).toEqual({ name: 'Character', params: { uuid: 'char-1' } })
  })
})
