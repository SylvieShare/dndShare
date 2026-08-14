import { describe, expect, it } from 'vitest'
import {
  SESSION_IMAGE_CATEGORIES,
  SESSION_IMAGE_PRESETS,
  sessionImageCategory,
  sessionImagePresetUrl,
} from './sessionImages'

describe('session image catalogue', () => {
  it('groups every preset exactly once', () => {
    const grouped = SESSION_IMAGE_CATEGORIES.flatMap(category => category.presets.map(preset => preset.key))
    expect(grouped).toEqual(SESSION_IMAGE_PRESETS.map(preset => preset.key))
    expect(new Set(grouped).size).toBe(grouped.length)
  })

  it('keeps story covers in their own shared category', () => {
    const story = SESSION_IMAGE_CATEGORIES.find(category => category.key === 'story')
    expect(story?.presets.map(preset => preset.key)).toEqual([
      'battle', 'investigation', 'negotiation', 'chase', 'puzzle', 'discovery',
    ])
    expect(sessionImageCategory('puzzle')).toBe(story)
  })

  it('resolves preset assets from the common directory', () => {
    expect(sessionImagePresetUrl('discovery')).toBe('/static/chapter-presets/discovery.jpg')
  })
})
