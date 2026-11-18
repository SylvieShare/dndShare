import { createApp, h, reactive, watch } from 'vue'
import { createPinia } from 'pinia'
import SessionParticipantCard from '../../../src/features/sessions/components/SessionParticipantCard.vue'
import EncounterRow from '../../../src/features/sessions/components/EncounterRow.vue'
import { useTemplateStore } from '../../../src/stores/template'
import { useSuggestStore } from '../../../src/stores/suggest'
import { applyDocumentPatches } from '../../../src/shared/lib/documentPatch'
import '@sylvieshare/share-ui/styles.css'
import '../../../src/app/theme.css'
import '../../../src/app/fonts.css'
import '../../../src/features/sessions/pages/styles/ViewSession.css'
import '../../../src/features/sessions/components/styles/EncounterTab.css'
const pinia = createPinia()
useTemplateStore(pinia).templates = [{ id: 1, name: 'DND5' }]
useSuggestStore(pinia).set(3, [])
const state = reactive({ combat: true, compact: false, dm: true, rejectStatusSave: false, selected: false, npcSelected: false, npcSection: 'reserve-npc', active: false, challenge: false, drags: 0, rerolls: [] })
const player = reactive({ uid: 'player', type: 'player', charId: 1, initiative: null, position: 'reserve' })
const npc = reactive({ uid: 'npc', type: 'npc', name: 'Гоблин', initiative: null, position: 'reserve', markerLetter: 'Б' })
const participant = reactive({ charId: 1, charUuid: 'participant-status-test', templateId: 1, sourceVersionId: 1, version: 1, data: { values: { name: 'Тиф', race: { name: 'Эльф' }, classes: [{ name: 'Плут' }], hp: { current: 18, max: 24 }, lvl: { level: 5 }, WIS: { value: 16, skills: { 10: { up: 1 } } }, INT: { value: 14, skills: { 9: { up: 2 } } }, DEX: { value: 14 }, armor: {} } } })
const encounter = reactive({
  encounter: { active: false },
  reserveTabs: [{id:"default",name:"Запас",permanent:true}],
  reserveIdFor: () => "default",
  sortable: { isSource: () => false, shouldSuppressClick: () => false, startDrag: () => { state.drags++ } },
  isSelected: () => state.npcSelected, toggleSelected: () => { state.npcSelected = !state.npcSelected },
  sendCombatantsTo: rows => rows.forEach(c => { c.position = 'combat'; c.initiative ??= 12 }),
  setInitiative: (c, value) => { c.initiative = value }, rollCombatantInitiative: c => { c.initiative = 17 },
  setSide: (c, value) => { if (value) c.side = value; else delete c.side },
  findParticipant: () => participant,
  canEditPlayerHp: () => true, participantColor: () => null, tileColor: () => null,
  npcName: () => 'Гоблин', subtitle: () => '', challenge: { ability: 'DEX', savingThrow: true }, challengeResult: actor => state.challenge && actor.uid === npc.uid ? { roll: 12, bonus: 2, total: 14 } : null, challengeAbilityMeta: () => ({ value: 'DEX', label: 'Ловкость' }),
  rerollChallenge: (_, mode) => { state.rerolls.push(mode) },
  statesBlock: () => null, statesValue: c => c.states || [], setStates: (c, ids) => { c.states = ids }, displayAc: () => 13, badgeClass: () => '', badgeLabel: () => 'ВРАГ',
  npcItem: () => null, avatarStyle: () => ({}), npcHpFormula: () => null,
  hpPercent: () => 100, hpColor: () => 'var(--success)', hpTempValue: () => 0, hpTempPercent: () => 0, hpLabel: () => '10 / 10', npcDsHp: () => ({ current: 10 }), SIDE_OPTIONS: [],
})
const statusItems = [
  { id:703,typeId:15,name:'Истощение',compatibility:[{sourceVersionId:1,status:'native'}],data:{code:'exhaustion',polarity:'negative'} },
  { id:704,typeId:15,name:'Вдохновение',compatibility:[{sourceVersionId:1,status:'native'}],data:{code:'inspiration',polarity:'positive'} },
  { id: 701, typeId: 15, name: 'Благословение', svg: '<svg viewBox="0 0 24 24"><path d="M12 2v20M2 12h20" /></svg>', data: { polarity: 'positive', level: 1, max_level: 3, desc: '<p>Добавьте к броскам атаки и спасброскам 1d4.</p>' } },
  { id: 702, typeId: 15, name: 'Отравление', svg: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" /></svg>', data: { polarity: 'negative', repeat_save: { ability: 3, dc: 12, timing: 'turn_end' }, desc: '<p>Помеха броскам атаки и проверкам характеристик.</p>' } },
]
const writes = []
let serverData, serverVersion = 1
window.fetch = async (input, options = {}) => {
  const url = new URL(input, window.location.origin)
  if (url.pathname === '/api/items/by-ids') return Response.json({ items: statusItems.filter(item => (url.searchParams.get('ids') || '').split(',').includes(String(item.id))) })
  if (url.pathname === '/api/items') return Response.json({ items: statusItems })
  if (url.pathname === '/api/item-types/15') return Response.json({ id: 15, name: 'Эффекты', fields: [] })
  if (url.pathname === '/api/char/participant-status-test/data' && options.method === 'PATCH') {
    const packet = JSON.parse(options.body)
    writes.push(packet)
    if (state.rejectStatusSave) return Response.json({ desc: 'Нет прав на изменение персонажа' }, { status: 403 })
    serverData = applyDocumentPatches(serverData || JSON.parse(JSON.stringify(participant.data)), packet.patches)
    return Response.json({ version: ++serverVersion, data: serverData })
  }
  return Response.json({ items: [] })
}
watch(()=>state.npcSection,value=>{npc.position=value==='combat'?'combat':value==='dead'?'dead':'reserve'},{flush:'sync'})
window.controls = { state, encounter, player, participant, npc, writes }
createApp({ render: () => h('main', { style: 'padding:20px;max-width:850px' }, [
  h('div', { class: ['campaign-workspace', state.combat && 'campaign-workspace--combat'], style: 'height:auto;overflow:visible' }, h('div', { class: 'participant-test-column', style: `position:relative;display:flex;max-height:70vh;overflow-y:auto;width:${state.combat ? 309 : 264}px` }, h(SessionParticipantCard, { participant, isDm: state.dm, compact: state.compact, combatMode: state.combat, combatEditable: true, combatant: player, combatSelected: state.selected, reorderEnabled: true, 'onUpdate:combat-selected': value => { state.selected = value }, 'onDrag-start': () => { state.drags++ } }))),
  h('div', { class: 'enc-combat-layout', style: 'margin-top:24px' }, h('div', { class: 'enc-combat-primary' }, h(EncounterRow, { combatant: npc, section: state.npcSection }))),
]) }).use(pinia).provide('applicationEncounter', encounter).provide('encounter', encounter).mount('#app')
