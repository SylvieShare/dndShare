import { describe, expect, it } from 'vitest'
import { resolveAppNavigation } from './appNavigation'

describe('app navigation', () => {
  it('keeps public navigation limited to the handbook', () => {
    expect(resolveAppNavigation({ path: '/handbook/objects' })).toEqual([
      expect.objectContaining({ key: 'handbook', active: true }),
    ])
  })

  it('adds authenticated and admin sections with route-aware active states', () => {
    const items = resolveAppNavigation({ authenticated: true, admin: true, path: '/char/example' })

    expect(items.map(item => item.key)).toEqual(['handbook', 'sessions', 'characters', 'admin'])
    expect(items.find(item => item.key === 'characters')?.active).toBe(true)
    expect(items.filter(item => item.active)).toHaveLength(1)
  })
})
