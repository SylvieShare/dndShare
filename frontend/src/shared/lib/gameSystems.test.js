import { describe, expect, it } from 'vitest'
import { gameSystemSlug, isDnd5e2014, rulesPathForGameContext } from './gameSystems'

describe('game system route helpers', () => {
  it('creates stable physical rules paths', () => {
    expect(gameSystemSlug('Vampire: TM')).toBe('vampire-tm')
    expect(rulesPathForGameContext({ sourceName: 'DND5e', version: '2014' }))
      .toBe('/rules/dnd5e/2014')
    expect(rulesPathForGameContext({ sourceName: 'Vampire: TM', version: 'V20' }))
      .toBe('/rules/vampire-tm/v20')
  })

  it('recognises the only edition with searchable player rules', () => {
    expect(isDnd5e2014({ sourceName: 'DND5e', version: '2014' })).toBe(true)
    expect(isDnd5e2014({ sourceName: 'DND5e', version: '2024' })).toBe(false)
  })
})
