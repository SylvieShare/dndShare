import { describe, expect, it } from 'vitest'
import { encounterEventData } from '../lib/encounterEventData'
import { useEncounterNpcData } from './useEncounterNpcData'

describe('encounter NPC actor name', () => {
  it('shows temporary Wisdom and adjusts an explicit save, then restores both on removal', () => {
    const data = useEncounterNpcData()
    data.cacheItem({ id: 1, data: { stats: { wis: 16 }, saving_throws: { wis: 5 } } })
    data.cacheItem({ id: 2, data: { derived_effects: [{ kind: 'ability_bonus', ability_ids: [5], value: 2 }] } })
    const npc = { type: 'npc', itemId: 1, effectInstances: [{ effect_id: 2 }] }
    expect(data.npcAbilityScore(npc, 'WIS')).toBe(18)
    expect(data.npcSavingThrow(npc, 'WIS')).toBe(6)
    expect(data.npcItem(npc).data.stats.wis).toBe(16)
    npc.effectInstances = []
    expect(data.npcAbilityScore(npc, 'WIS')).toBe(16)
    expect(data.npcSavingThrow(npc, 'WIS')).toBe(5)
  })
  it('keeps the name separate from the event marker snapshot', () => {
    const npcData = useEncounterNpcData()
    npcData.cacheItem({ id: 1635, name: 'Кобольд', data: {} })
    const combatant = { uid: 'kobold-b', type: 'npc', itemId: 1635, markerLetter: 'b', iconColor: 'var(--success)' }

    expect(npcData.npcName(combatant)).toBe('Кобольд')
    expect(encounterEventData(combatant, npcData.npcName(combatant))).toEqual({ npcActor: { uid: 'kobold-b', name: 'Кобольд', letter: 'B', color: 'var(--success)' } })
  })

  it('keeps a creature without a valid marker unchanged', () => {
    const npcData = useEncounterNpcData()
    const combatant = { type: 'npc', override: { name: 'Страж' }, markerLetter: '?' }

    expect(encounterEventData(combatant, npcData.npcName(combatant)).npcActor).toMatchObject({ name: 'Страж', letter: null, color: 'var(--side-enemy)' })
  })
})
