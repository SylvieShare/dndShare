import { describe, expect, it } from 'vitest'
import { contentScopeQuery, normalizeContentSourceSettings } from './contentSourcesApi'

describe('content source settings', () => {
  it('uses all-sources mode when character settings are absent', () => {
    expect(normalizeContentSourceSettings(null)).toEqual({ mode: 'all', ids: [], allowLegacy: false })
  })

  it('deduplicates selected source ids', () => {
    expect(normalizeContentSourceSettings({ mode: 'selected', ids: [2, '2', 3], allowLegacy: true }))
      .toEqual({ mode: 'selected', ids: [2, 3], allowLegacy: true })
  })

  it('serializes edition, allowlist and legacy policy for item endpoints', () => {
    expect(contentScopeQuery({ mode: 'selected', ids: [4, 7], allowLegacy: true }, 12))
      .toBe('&sourceVersionId=12&contentSourceIds=4%2C7&allowLegacy=true')
  })

  it('does not send an allowlist in all-sources mode', () => {
    expect(contentScopeQuery({ mode: 'all', ids: [4], allowLegacy: false }, 12))
      .toBe('&sourceVersionId=12')
  })

  it('keeps an empty explicit selection distinct from all sources', () => {
    expect(contentScopeQuery({ mode: 'selected', ids: [], allowLegacy: false }, 12))
      .toBe('&sourceVersionId=12&contentSourceIds=')
  })
})
