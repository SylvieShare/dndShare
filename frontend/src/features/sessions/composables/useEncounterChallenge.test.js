import { describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ref } from 'vue'
import { useSessionEventsStore } from '@/stores/sessionEvents'
import * as api from '@/shared/api/sessionDiceApi'
import {
  npcChallengeBonus,
  playerChallengeBonus,
  useEncounterChallenge,
} from '@/features/sessions/composables/useEncounterChallenge'

describe('encounter challenge bonuses', () => {
  it('presents pending checks and extra dice locally without saving unknown faces', async () => {
    setActivePinia(createPinia())
    const events = useSessionEventsStore()
    events.sessionUuid = 'game'
    vi.spyOn(events, 'publish').mockResolvedValue(null)
    let finish
    const server = vi.spyOn(api, 'rollSessionD20').mockImplementation(() => new Promise(resolve => { finish = resolve }))
    const npc = { uid: 'goblin', type: 'npc' }
    const encounter = ref({ combatants: [npc] })
    const challenge = useEncounterChallenge({ encounter, selectedUids: ref(new Set(['goblin'])),
      findParticipant: () => null, playerDisplayName: () => '', npcName: () => 'Гоблин',
      npcAbilityScore: () => 14, npcSavingThrow: () => null })
    try {
      const pending = challenge.runChallenge({ ability: 'DEX' })
      await vi.waitFor(() => expect(server).toHaveBeenCalledTimes(1))
      expect(challenge.challengeResult(npc)).toMatchObject({ pending: true, rolls: [null] })
      expect(encounter.value.challenge).toBeUndefined()
      finish({ rolls: [12] })
      await pending
      expect(challenge.challengeResult(npc)).toMatchObject({ roll: 12, total: 14 })
      expect(encounter.value.challenge.results.goblin.pending).toBeUndefined()

      const extra = challenge.rerollChallenge(npc, 'advantage')
      await vi.waitFor(() => expect(server).toHaveBeenCalledTimes(2))
      expect(challenge.challengeResult(npc)).toMatchObject({ pending: true, rolls: [12, null] })
      expect(encounter.value.challenge.results.goblin).toMatchObject({ roll: 12, total: 14 })
      finish({ rolls: [20] })
      await extra
      expect(challenge.challengeResult(npc)).toMatchObject({ rolls: [12, 20], total: 22 })
      expect(challenge.challengeResult(npc).pending).toBeUndefined()
    } finally { server.mockRestore() }
  })
  it('uses the player ability modifier for a check', () => {
    const participant = {
      data: { values: { DEX: { value: { base: 16, bonuses: [] }, save_up: true } } },
    }

    expect(playerChallengeBonus(participant, 'DEX', false)).toBe(3)
  })

  it('adds player proficiency and save bonuses only for a saving throw', () => {
    const participant = {
      data: {
        values: {
          lvl: { level: 5 },
          prof_bonus: { auto: true, bonuses: [{ value: 1 }] },
          DEX: {
            value: { base: 16, bonuses: [] },
            save_up: true,
            save_bonuses: [{ value: 2 }],
          },
        },
      },
    }

    expect(playerChallengeBonus(participant, 'DEX', true)).toBe(9)
  })

  it('uses an explicit NPC saving throw and otherwise falls back to its ability', () => {
    expect(npcChallengeBonus(14, 5, true)).toBe(5)
    expect(npcChallengeBonus(14, 5, false)).toBe(2)
    expect(npcChallengeBonus(14, null, true)).toBe(2)
  })

  it.each([false, true])('rolls selected scene and reserve creatures, excluding the graveyard (active=%s)', async active => {
    setActivePinia(createPinia())
    const sceneNpc = { uid: 'scene-npc', type: 'npc' }
    const otherSceneNpc = { uid: 'other-scene-npc', type: 'npc' }
    const reserveNpc = { uid: 'reserve-npc', type: 'npc', position: 'reserve' }
    const deadNpc = { uid: 'dead-npc', type: 'npc', position: 'dead' }
    const encounter = ref({ active, combatants: [sceneNpc, otherSceneNpc, reserveNpc, deadNpc] })
    const challenge = useEncounterChallenge({
      encounter,
      selectedUids: ref(new Set(['scene-npc', 'reserve-npc', 'dead-npc', 'deleted-npc'])),
      findParticipant: () => null,
      playerDisplayName: () => 'Игрок',
      npcName: combatant => combatant.uid,
      npcAbilityScore: () => 10,
      npcSavingThrow: () => null,
    })

    expect(challenge.selectedChallengeCount.value).toBe(2)
    await challenge.runChallenge({ ability: 'DEX', savingThrow: false })
    expect(Object.keys(encounter.value.challenge.results)).toEqual(['scene-npc', 'reserve-npc'])
  })

  it('rolls one extra die and keeps it by advantage or disadvantage', async () => {
    setActivePinia(createPinia())
    const sceneNpc = { uid: 'scene-npc', type: 'npc' }
    const encounter = ref({
      active: true,
      combatants: [sceneNpc],
      challenge: {
        ability: 'DEX',
        savingThrow: false,
        results: { 'scene-npc': { roll: 10, bonus: 2, total: 12 } },
      },
    })
    const challenge = useEncounterChallenge({
      encounter,
      selectedUids: ref(new Set(['scene-npc'])),
      findParticipant: () => null,
      playerDisplayName: () => 'Игрок',
      npcName: () => 'Гоблин',
      npcAbilityScore: () => 14,
      npcSavingThrow: () => null,
    })
    const random = vi.spyOn(Math, 'random')

    random.mockReturnValueOnce(0.99)
    await challenge.rerollChallenge(sceneNpc, 'advantage')
    expect(encounter.value.challenge.results['scene-npc']).toEqual({
      roll: 20,
      rolls: [10, 20],
      dropped: [0],
      bonus: 2,
      total: 22,
      revision: 1,
    })

    random.mockReturnValueOnce(0)
    await challenge.rerollChallenge(sceneNpc, 'disadvantage')
    expect(encounter.value.challenge.results['scene-npc']).toEqual({
      roll: 1,
      rolls: [20, 1],
      dropped: [0],
      bonus: 2,
      total: 3,
      revision: 2,
    })

    random.mockRestore()
  })
})
