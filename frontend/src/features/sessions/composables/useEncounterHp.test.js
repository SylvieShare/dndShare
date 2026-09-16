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

  it('submits selected NPC and player damage together without changing HP optimistically', async () => {
    const participant = { charId: 7, charUuid: 'char-7', hp: { current: 10, max: 12, temp: 3 } }
    const encounter = ref({ combatants: [
      { uid: 'npc', type: 'npc', position: 'combat', hpCurrent: 8, hpTemp: 2 },
      { uid: 'player', type: 'player', charId: 7, position: 'combat' },
    ] })
    const applyLocalPatches = vi.fn(), applyCombatDamage = vi.fn()
    const hp = useEncounterHp({
      encounter, applyCombatDamage,
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
    expect(applyCombatDamage).toHaveBeenCalledWith(encounter.value.combatants, 5)
    expect(encounter.value.combatants[0]).toMatchObject({ hpCurrent: 8, hpTemp: 2 })
    expect(patchData).not.toHaveBeenCalled()
    expect(applyLocalPatches).not.toHaveBeenCalled()
    applyCombatDamage.mockRejectedValueOnce(new Error('Offline'))
    await expect(hp.applyDamageToSelected(5)).rejects.toThrow('Offline')
  })
})
