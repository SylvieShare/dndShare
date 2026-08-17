import { describe, expect, it } from 'vitest'
import { resolveAppNavigation } from './appNavigation'

describe('app navigation', () => {
  it('keeps the handbook, rules and character wizard public', () => {
    const items = resolveAppNavigation({ path: '/handbook/objects' })
    expect(items.map(item => item.key)).toEqual(['handbook', 'rules', 'create-character'])
    expect(items[0]).toEqual(expect.objectContaining({ key: 'handbook', active: true }))
  })

  it('treats rules as a separate top-level section', () => {
    const items = resolveAppNavigation({
      path: '/rules/dnd5e/2014/spellcasting',
      rulesTo: '/rules/vampire-tm/v20',
    })
    expect(items.find(item => item.key === 'rules')).toEqual(expect.objectContaining({
      title: 'Правила',
      to: '/rules/vampire-tm/v20',
      active: true,
    }))
    expect(items.find(item => item.key === 'handbook')?.active).toBe(false)
  })

  it('adds authenticated and admin sections with route-aware active states', () => {
    const items = resolveAppNavigation({ authenticated: true, admin: true, path: '/char/example' })

    expect(items.map(item => item.key)).toEqual(['handbook', 'rules', 'characters', 'create-character', 'sessions', 'admin'])
    expect(items.find(item => item.key === 'characters')?.active).toBe(true)
    expect(items.filter(item => item.active)).toHaveLength(1)
  })

  it('keeps character creation under Characters for authenticated users', () => {
    const items = resolveAppNavigation({ authenticated: true, path: '/chars/new' })
    expect(items.map(item => item.key)).toEqual(['handbook', 'rules', 'characters', 'create-character', 'sessions'])
    expect(items.find(item => item.key === 'characters')?.active).toBe(false)
    expect(items.find(item => item.key === 'create-character')?.active).toBe(true)
  })
})
