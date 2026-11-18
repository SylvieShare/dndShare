import { ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { patchData } = vi.hoisted(() => ({ patchData: vi.fn() }))
vi.mock('@/shared/api/charactersApi', () => ({ charactersApi: { patchData } }))
vi.mock('@/features/sessions/lib/participantView', () => ({
  pvHp: participant => participant.hp,
  pvHpPath: () => 'hp',
}))

import { useEncounterHp } from './useEncounterHp'

describe('encounter damage calculator', () => {
  beforeEach(() => patchData.mockReset().mockResolvedValue(undefined))

  it('delegates calculator damage to the impact handler', async () => {
    const participant = { charId: 7, charUuid: 'char-7', hp: { current: 10, max: 12, temp: 3 } }
    const encounter = ref({ combatants: [
      { uid: 'npc', type: 'npc', position: 'combat', hpCurrent: 8, hpTemp: 2 },
      { uid: 'player', type: 'player', charId: 7, position: 'combat' },
    ] })
    const applyLocalPatches = vi.fn(), applyCombatDamage = vi.fn()
    const hp = useEncounterHp({
      applyCombatDamage,
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

    const npc = encounter.value.combatants[0]
    await hp.applyDamageToCombatant(npc, 5)
    expect(applyCombatDamage).toHaveBeenCalledWith([npc], 5)
    expect(encounter.value.combatants[0]).toMatchObject({ hpCurrent: 8, hpTemp: 2 })
    expect(patchData).not.toHaveBeenCalled()
    expect(applyLocalPatches).not.toHaveBeenCalled()
    applyCombatDamage.mockRejectedValueOnce(new Error('Offline'))
    await expect(hp.applyDamageToCombatant(npc, 5)).rejects.toThrow('Offline')
  })
})
