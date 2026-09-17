import { computed, ref } from 'vue'
import { describe, expect, it } from 'vitest'
import { useEncounterFlow } from './useEncounterFlow'

function createFlow() {
  const encounter = ref({ active: true, round: 1, turnIndex: 0, combatants: [
    { uid: 'player', type: 'player', position: 'reserve', initiative: null, surprised: true },
    { uid: 'npc', type: 'npc', position: 'reserve', initiative: null },
  ] })
  const selectedUids = ref(new Set(['player', 'npc']))
  const inCombat = computed(() => encounter.value.combatants.filter(item => item.position === 'combat'))
  const flow = useEncounterFlow({
    encounter,
    getCombatant: uid => encounter.value.combatants.find(item => item.uid === uid),
    mutate: callback => callback(),
    inCombat,
    turnOrder: inCombat,
    selectedUids,
    unselect: () => {},
    rollInitiativeFor: () => 12,
  })
  return { encounter, flow }
}

describe('encounter group movement', () => {
  it('rolls one participant before combat and keeps that initiative when combat starts', () => {
    const { encounter, flow } = createFlow()
    encounter.value.active = false
    const player = encounter.value.combatants[0]
    flow.rollCombatantInitiative(player)
    expect(player.initiative).toBe(12)
    expect(encounter.value.combatants[1].initiative).toBeNull()
    flow.setInitiative(player, 18)
    flow.toggleCombat()
    expect(player.initiative).toBe(18)
    flow.rollCombatantInitiative(player)
    expect(player.initiative).toBe(18)
  })
  it('moves an explicit player subset without also moving selected NPCs', () => {
    const { encounter, flow } = createFlow()
    flow.sendCombatantsTo([encounter.value.combatants[0]], 'combat')
    expect(encounter.value.combatants[0]).toMatchObject({ position: 'combat', initiative: 12 })
    expect(encounter.value.combatants[1]).toMatchObject({ position: 'reserve', initiative: null })
  })

  it('keeps an explicit zero initiative and rolls only when the field is cleared', () => {
    const { encounter, flow } = createFlow()
    const player = encounter.value.combatants[0]
    flow.setInitiative(player, 0)
    flow.sendCombatantsTo([player], 'combat')
    expect(player.initiative).toBe(0)
    flow.sendCombatantsTo([player], 'reserve')
    flow.setInitiative(player, null)
    flow.sendCombatantsTo([player], 'combat')
    expect(player.initiative).toBe(12)
  })

  it('clears transient combat state when returning participants to reserve', () => {
    const { encounter, flow } = createFlow()
    encounter.value.combatants[0].position = 'combat'
    encounter.value.combatants[0].initiative = 16
    flow.sendCombatantsTo([encounter.value.combatants[0]], 'reserve')
    expect(encounter.value.combatants[0]).toMatchObject({ position: 'reserve', initiative: null, surprised: false })
  })
})
