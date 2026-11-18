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
  it('starts with a prepared scene after selection has been cleared', () => {
    const { encounter, flow } = createFlow()
    encounter.value.active = false
    flow.sendCombatantsTo([encounter.value.combatants[0]],'combat')
    // Neither combatant needs to remain selected to keep the prepared scene.
    const start = useEncounterFlow({encounter,getCombatant:uid=>encounter.value.combatants.find(row=>row.uid===uid),mutate:fn=>fn(),
      inCombat:computed(()=>encounter.value.combatants.filter(row=>row.position==='combat')),turnOrder:computed(()=>[]),selectedUids:ref(new Set()),unselect:()=>{},rollInitiativeFor:()=>12})
    start.toggleCombat()
    expect(encounter.value.active).toBe(true)
    expect(encounter.value.combatants[0]).toMatchObject({position:'combat',initiative:12})
    expect(encounter.value.combatants[1].position).toBe('reserve')
  })
  it('rolls one participant before combat and keeps that initiative when combat starts', () => {
    const { encounter, flow } = createFlow()
    encounter.value.active = false
    const player = encounter.value.combatants[0]
    flow.rollCombatantInitiative(player)
    expect(player.initiative).toBe(12)
    expect(encounter.value.combatants[1].initiative).toBeNull()
    flow.setInitiative(player, 18)
    flow.sendCombatantsTo([player],'combat')
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

it('sets all NPC relations and removes the tag without accepting unknown values', () => {
  const { encounter, flow } = createFlow();
  const npc = encounter.value.combatants[1];
  for (const side of ['enemy', 'ally', 'minion', 'neutral']) {
    flow.setSide(npc, side);
    expect(npc.side).toBe(side);
  }
  flow.setSide(npc, 'unknown');
  expect(npc.side).toBe('neutral');
  flow.setSide(npc, null);
  expect(npc).not.toHaveProperty('side');
});

it('starting combat never adds selected actors that were not put on the scene',()=>{
  const {encounter,flow}=createFlow();encounter.value.active=false
  flow.toggleCombat();expect(encounter.value.active).toBe(false)
  flow.sendCombatantsTo([encounter.value.combatants[0]],'combat');flow.toggleCombat()
  expect(encounter.value.combatants[1].position).toBe('reserve')
})
it('reordering a home group retains combat participation and its canonical actor',()=>{
  const {encounter,flow}=createFlow(),npc=encounter.value.combatants[1]
  npc.position='combat';npc.reserveTabId='wolves'
  flow.performSortDrop({item:npc,fromGroup:'reserve-npc',toGroup:'reserve-npc',toIndex:0})
  expect(encounter.value.combatants.filter(row=>row.uid===npc.uid)).toHaveLength(1)
  expect(npc).toMatchObject({position:'combat',reserveTabId:'wolves'})
})

it('ending combat retains the scene, actor data and home groups until explicitly removed',()=>{
  const {encounter,flow}=createFlow()
  Object.assign(encounter.value.combatants[0],{position:'combat',hpCurrent:17,initiative:18})
  Object.assign(encounter.value.combatants[1],{position:'combat',hpCurrent:7,reserveTabId:'wolves',initiative:12})
  flow.toggleCombat()
  expect(encounter.value).toMatchObject({active:false,round:0,turnIndex:0})
  expect(encounter.value.combatants.map(row=>row.position)).toEqual(['combat','combat'])
  expect(encounter.value.combatants[0]).toMatchObject({hpCurrent:17,initiative:null})
  expect(encounter.value.combatants[1]).toMatchObject({hpCurrent:7,reserveTabId:'wolves',initiative:null})
  flow.sendCombatantsTo([encounter.value.combatants[1]],'reserve')
  expect(encounter.value.combatants[0].position).toBe('combat')
  expect(encounter.value.combatants[1].position).toBe('reserve')
})
