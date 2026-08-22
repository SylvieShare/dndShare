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
})
