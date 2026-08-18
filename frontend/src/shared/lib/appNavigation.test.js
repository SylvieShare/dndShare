import { describe, expect, it } from 'vitest'
import { resolveAppNavigation } from './appNavigation'

describe('app navigation', () => {
  it('keeps the handbook, rules and character wizard public', () => {
    const items = resolveAppNavigation({ path: '/handbook/objects' })
    expect(items.map(item => item.key)).toEqual(['handbook', 'rules', 'create-character'])
    expect(items[0]).toEqual(expect.objectContaining({ key: 'handbook', active: true }))
    expect(items[1]).toEqual(expect.objectContaining({ title: 'Правила игрока', group: 'player' }))
  })

  it('treats rules as a separate top-level section', () => {
    const items = resolveAppNavigation({
      path: '/rules/dnd5e/2014/spellcasting',
      rulesTo: '/rules/vampire-tm/v20',
    })
    expect(items.find(item => item.key === 'rules')).toEqual(expect.objectContaining({
      title: 'Правила игрока',
      group: 'player',
      to: '/rules/vampire-tm/v20',
      active: true,
    }))
    expect(items.find(item => item.key === 'handbook')?.active).toBe(false)
  })

  it('adds authenticated and admin sections with route-aware active states', () => {
    const items = resolveAppNavigation({ authenticated: true, hasCharacters: true, admin: true, path: '/char/example' })

    expect(items.map(item => item.key)).toEqual(['handbook', 'rules', 'characters', 'sessions', 'admin'])
    expect(items.find(item => item.key === 'characters')?.active).toBe(true)
    expect(items.filter(item => item.active)).toHaveLength(1)
  })

  it('shows character creation instead of Characters when the authenticated user has none', () => {
    const items = resolveAppNavigation({ authenticated: true, path: '/chars/new' })
    expect(items.map(item => item.key)).toEqual(['handbook', 'rules', 'create-character', 'sessions'])
    expect(items.find(item => item.key === 'characters')).toBeUndefined()
    expect(items.find(item => item.key === 'create-character')?.active).toBe(true)
  })

  it('keeps Characters active on the creation route once a character exists', () => {
    const items = resolveAppNavigation({ authenticated: true, hasCharacters: true, path: '/chars/new' })
    expect(items.map(item => item.key)).toEqual(['handbook', 'rules', 'characters', 'sessions'])
    expect(items.find(item => item.key === 'characters')?.active).toBe(true)
  })
})
