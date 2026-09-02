import { ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { patchData } = vi.hoisted(() => ({ patchData: vi.fn() }))
vi.mock('@/shared/api/charactersApi', () => ({ charactersApi: { patchData } }))
vi.mock('@/features/sessions/lib/participantView', () => ({
  pvHp: participant => participant.hp,
  pvHpPath: () => 'hp',
}))

import { useEncounterHp } from './useEncounterHp'

describe('encounter bulk damage', () => {
  beforeEach(() => patchData.mockReset().mockResolvedValue(undefined))

  it('applies one amount to selected NPC and player HP, consuming temporary HP first', async () => {
    const participant = { charId: 7, charUuid: 'char-7', hp: { current: 10, max: 12, temp: 3 } }
    const encounter = ref({ combatants: [
      { uid: 'npc', type: 'npc', position: 'combat', hpCurrent: 8, hpTemp: 2 },
      { uid: 'player', type: 'player', charId: 7, position: 'combat' },
    ] })
    const applyLocalPatches = vi.fn()
    const hp = useEncounterHp({
      encounter,
      selectedUids: ref(new Set(['npc', 'player'])),
      getCombatant: uid => encounter.value.combatants.find(item => item.uid === uid),
      mutate: callback => callback(),
      canEditPlayers: ref(true),
      findParticipant: charId => charId === 7 ? participant : null,
      applyLocalPatches,
      getPlayerHp: () => participant.hp,
      getPlayerAc: () => 10,
      npcName: () => 'Гоблин',
      npcAc: () => 12,
      npcHpMax: () => 8,
      npcHpFormula: () => '',
    })

    expect(hp.selectedDamageCount.value).toBe(2)
    await hp.applyDamageToSelected(5)
    expect(encounter.value.combatants[0]).toMatchObject({ hpCurrent: 5, hpTemp: 0 })
    expect(patchData).toHaveBeenCalledWith('char-7', [
      { path: 'hp.current', value: 8 },
      { path: 'hp.temp', value: 0 },
    ])
    expect(applyLocalPatches).toHaveBeenCalledWith(7, [
      { path: 'hp.current', value: 8 },
      { path: 'hp.temp', value: 0 },
    ])
  })
})
