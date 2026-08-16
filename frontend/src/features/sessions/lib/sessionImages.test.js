import { describe, expect, it } from 'vitest'
import {
  NPC_IMAGE_CATEGORIES,
  NPC_IMAGE_PRESETS,
  SESSION_IMAGE_CATEGORIES,
  SESSION_IMAGE_PRESETS,
  npcImagePresetUrl,
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

  it('keeps NPC portraits in an independent grouped catalogue', () => {
    const grouped = NPC_IMAGE_CATEGORIES.flatMap(category => category.presets.map(preset => preset.key))
    expect(grouped).toEqual(NPC_IMAGE_PRESETS.map(preset => preset.key))
    expect(grouped.every(key => key.startsWith('npc-'))).toBe(true)
    expect(npcImagePresetUrl('npc-scholar')).toBe('/static/npc-presets/npc-scholar.jpg')
  })
})
