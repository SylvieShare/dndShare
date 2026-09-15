import { describe, expect, it } from 'vitest'
import { encounterEventData } from '../lib/encounterEventData'
import { useEncounterNpcData } from './useEncounterNpcData'

describe('encounter NPC actor name', () => {
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
