import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { useCharacterRollEffects } from './useCharacterRollEffects'

describe('useCharacterRollEffects', () => {
  it('combines registered contributors with armor before resolving the mode', () => {
    const armor = { state: ref({
      strengthDexDisadvantage: true,
      nonproficient: [{ name: 'Кольчуга' }],
    }) }
    const rolls = useCharacterRollEffects(armor)
    const unregister = rolls.register(context => context.kind === 'tool'
      ? [{ mode: 'advantage', source: 'Подходящая работа' }]
      : [])

    expect(rolls.resolve('auto', { kind: 'tool', abilitySuggestId: 1 })).toMatchObject({
      mode: 'normal',
      cancelled: true,
    })
    unregister()
    expect(rolls.resolve('auto', { kind: 'tool', abilitySuggestId: 1 }).mode).toBe('disadvantage')
  })
})
