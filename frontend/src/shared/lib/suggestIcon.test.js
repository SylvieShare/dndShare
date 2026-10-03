import { describe, expect, it } from 'vitest'
import { resolveSuggestIcon } from './suggestIcon'

describe('suggest icon sources', () => {
  it('keeps the shared image URL and inline SVG in independent slots', () => {
    const svg = '<svg viewBox="0 0 64 64"><circle r="20"/></svg>'
    expect(resolveSuggestIcon({ iconImageUrl: '/gold.webp', svg })).toEqual({ iconImageUrl: '/gold.webp', svg })
    expect(resolveSuggestIcon({ svg })).toEqual({ iconImageUrl: '', svg })
  })
  it('never passes inline SVG markup to an image src', () => {
    const svg = '  <svg><path/></svg>'
    expect(resolveSuggestIcon({ iconUrl: svg })).toEqual({ iconImageUrl: '', svg })
    expect(resolveSuggestIcon({ iconUrl: '/icon.webp' })).toEqual({ iconImageUrl: '/icon.webp', svg: '' })
  })
})
