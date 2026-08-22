import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import { useLevelUpFeatureChoices } from './useLevelUpFeatureChoices'

describe('useLevelUpFeatureChoices', () => {
  it('tracks several choices of one feature independently', () => {
    const feature = { id: 42, data: { choices: [
      { key: 'style', options: [{ value: 'defense', label: 'Защита' }] },
      { key: 'tool', from_suggest_id: 5 },
    ] } }
    const suggestStore = {
      ensure: vi.fn(),
      items: () => [{ id: 7, value: 'Лютня' }],
    }
    const choices = useLevelUpFeatureChoices(ref([feature]), suggestStore)
    const [style, tool] = choices.featureChoices(feature)

    choices.toggleChoice(feature, style, 'defense')
    choices.toggleChoice(feature, tool, 7)

    expect(choices.selections.value).toEqual({ '42:style': ['defense'], '42:tool': [7] })
    expect(choices.choiceComplete(feature)).toBe(true)
    expect(choices.complete.value).toBe(true)
  })

  it('combines dictionaries and filters character-ineligible options', () => {
    const feature = { id: 7, data: { choices: [{
      key: 'targets', source: 'suggest_union', count: 2,
      suggest_sources: [{ suggest_id: 15, prefix: 'skill', label: 'Навык' }, { suggest_id: 5, prefix: 'tool', label: 'Инструмент' }],
    }] } }
    const suggestStore = {
      ensure: vi.fn(),
      items: (id) => id === 15 ? [{ id: 2, value: 'Акробатика' }] : [{ id: 18, value: 'Воровские инструменты' }],
    }
    const choices = useLevelUpFeatureChoices(ref([feature]), suggestStore, (_feature, _choice, value) => ({ eligible: value !== 'skill:2' }))
    expect(choices.choiceOptions(feature)).toEqual([{
      value: 'tool:18', label: 'Воровские инструменты', desc: 'Инструмент',
    }])
  })
})
