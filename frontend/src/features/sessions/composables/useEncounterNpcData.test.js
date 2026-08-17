import { describe, expect, it } from 'vitest'
import { useEncounterNpcData } from './useEncounterNpcData'

describe('encounter NPC actor name', () => {
  it('adds the encounter marker letter without changing the regular display name', () => {
    const npcData = useEncounterNpcData()
    npcData.cacheItem({ id: 1635, name: 'Кобольд', data: {} })
    const combatant = { type: 'npc', itemId: 1635, markerLetter: 'b' }

    expect(npcData.npcName(combatant)).toBe('Кобольд')
    expect(npcData.npcActorName(combatant)).toBe('Кобольд B')
  })

  it('keeps a creature without a valid marker unchanged', () => {
    const npcData = useEncounterNpcData()
    const combatant = { type: 'npc', override: { name: 'Страж' }, markerLetter: '?' }

    expect(npcData.npcActorName(combatant)).toBe('Страж')
  })
})
