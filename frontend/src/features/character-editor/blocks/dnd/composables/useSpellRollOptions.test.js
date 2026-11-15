import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ref } from 'vue'
import { useSessionEventsStore } from '@/stores/sessionEvents'
import { useSpellRollOptions } from './useSpellRollOptions'

beforeEach(() => setActivePinia(createPinia()))
const entry = damage => ref({ item: { id: 500, name: 'Мистический заряд', data: { lvl: 0, damage: {
  range_attack: true, dices: [{ dice_id: 'd10', count: 1, type: 12 }],
  attack_chain: { trigger: 'none', unique: 'none' }, ...damage,
} } } })

describe('spell roll availability', () => {
  it.each([null, 'session'])('keeps eldritch blast damage available with session %s', sessionUuid => {
    useSessionEventsStore().sessionUuid = sessionUuid
    const result = useSpellRollOptions(entry())
    expect(result.hasSequence.value).toBe(false)
    expect(result.hasAttack.value).toBe(true)
    expect(result.options.value.map(option => option.key)).toEqual(['damage'])
  })

  it.each([
    { attack_chain: { trigger: 'matching_dice', sides: 6, matches: 2 } },
    { roll_table: { sides: 8, count: 2, source: 'damage' } },
  ])('keeps real sequence damage in the session chronicle: %j', damage => {
    const events = useSessionEventsStore()
    events.sessionUuid = 'session'
    const result = useSpellRollOptions(entry(damage))
    expect(result.hasSequence.value).toBe(true)
    expect(result.options.value).toEqual([])
    events.sessionUuid = null
    expect(result.hasSequence.value).toBe(false)
    expect(result.options.value.map(option => option.key)).toEqual(['damage'])
  })

  it('reacts when an existing chain is disabled', () => {
    useSessionEventsStore().sessionUuid = 'session'
    const spell = entry({ attack_chain: { trigger: 'always' } })
    const result = useSpellRollOptions(spell)
    expect(result.options.value).toEqual([])
    spell.value.item.data.damage.attack_chain.trigger = 'none'
    expect(result.options.value.map(option => option.key)).toEqual(['damage'])
  })
})
