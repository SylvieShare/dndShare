import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { useEncounterPlayers } from './useEncounterPlayers'

describe('encounter participant reconciliation', () => {
  it('adds joined players and removes players no longer in the session', () => {
    const participants = ref([{ charId: 2, charUuid: 'two' }, { charId: 3, charUuid: 'three' }])
    const players = useEncounterPlayers({ participants })
    const encounter = {
      combatants: [
        { uid: 'p-1', type: 'player', charId: 1 },
        { uid: 'p-2', type: 'player', charId: 2 },
        { uid: 'npc-1', type: 'npc', position: 'reserve' },
      ],
    }

    expect(players.reconcileParticipants(encounter)).toBe(true)
    expect(encounter.combatants.filter(item => item.type === 'player').map(item => item.charId)).toEqual([2, 3])
    expect(encounter.combatants.some(item => item.uid === 'npc-1')).toBe(true)
  })

  it('preserves persisted combat state for players already in the encounter', () => {
    const participants = ref([{ charId: 2, charUuid: 'two' }])
    const players = useEncounterPlayers({ participants })
    const persistedPlayer = {
      uid: 'p-2',
      type: 'player',
      charId: 2,
      position: 'combat',
      initiative: 17,
      surprised: true,
      tieBreak: 4,
    }
    const encounter = { combatants: [persistedPlayer] }

    expect(players.reconcileParticipants(encounter)).toBe(false)
    expect(encounter.combatants).toEqual([persistedPlayer])
  })
})
