import { describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ref } from 'vue'
import {
  npcChallengeBonus,
  playerChallengeBonus,
  useEncounterChallenge,
} from '@/features/sessions/composables/useEncounterChallenge'

describe('encounter challenge bonuses', () => {
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

  it('rolls only selected combatants that are currently on the scene', () => {
    setActivePinia(createPinia())
    const sceneNpc = { uid: 'scene-npc', type: 'npc' }
    const otherSceneNpc = { uid: 'other-scene-npc', type: 'npc' }
    const encounter = ref({ active: true, combatants: [sceneNpc, otherSceneNpc] })
    const challenge = useEncounterChallenge({
      encounter,
      inCombat: ref([sceneNpc, otherSceneNpc]),
      selectedUids: ref(new Set(['scene-npc', 'reserve-npc'])),
      findParticipant: () => null,
      playerDisplayName: () => 'Игрок',
      npcName: combatant => combatant.uid,
      npcAbilityScore: () => 10,
      npcSavingThrow: () => null,
    })

    expect(challenge.selectedChallengeCount.value).toBe(1)
    challenge.runChallenge({ ability: 'DEX', savingThrow: false })
    expect(Object.keys(encounter.value.challenge.results)).toEqual(['scene-npc'])
  })
})
