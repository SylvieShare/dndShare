import { createApp, h, reactive } from 'vue'
import { createPinia } from 'pinia'
import SessionParticipantCard from '../../../src/features/sessions/components/SessionParticipantCard.vue'
import EncounterRow from '../../../src/features/sessions/components/EncounterRow.vue'
import { useTemplateStore } from '../../../src/stores/template'
import { useSuggestStore } from '../../../src/stores/suggest'
import '@sylvieshare/share-ui/styles.css'
import '../../../src/app/theme.css'
import '../../../src/features/sessions/pages/styles/ViewSession.css'
const pinia = createPinia()
useTemplateStore(pinia).templates = [{ id: 1, name: 'DND5' }]
useSuggestStore(pinia).set(3, [])
const state = reactive({ combat: true, selected: false, npcSelected: false, active: false, challenge: false, drags: 0 })
const player = reactive({ uid: 'player', type: 'player', charId: 1, initiative: null, position: 'reserve' })
const npc = reactive({ uid: 'npc', type: 'npc', name: 'Гоблин', initiative: null, position: 'reserve', letter: 'Б' })
const participant = reactive({ charId: 1, templateId: 1, data: { values: { name: 'Тиф', race: { name: 'Эльф' }, classes: [{ name: 'Плут' }], hp: { current: 18, max: 24 }, lvl: { level: 5 }, WIS: { value: 16, skills: { 10: { up: 1 } } }, INT: { value: 14, skills: { 9: { up: 2 } } }, DEX: { value: 14 }, armor: {} } } })
const encounter = reactive({
  encounter: { active: false },
  sortable: { isSource: () => false, shouldSuppressClick: () => false, startDrag: () => { state.drags++ } },
  isSelected: () => state.npcSelected, toggleSelected: () => { state.npcSelected = !state.npcSelected },
  sendCombatantsTo: rows => rows.forEach(c => { c.position = 'combat'; c.initiative ??= 12 }),
  setInitiative: (c, value) => { c.initiative = value }, rollCombatantInitiative: c => { c.initiative = 17 },
  canEditPlayerHp: () => true, participantColor: () => null, tileColor: () => null,
  npcName: () => 'Гоблин', subtitle: () => '', challenge: { ability: 'DEX', savingThrow: true }, challengeResult: () => state.challenge ? { roll: 12, bonus: 2, total: 14 } : null, challengeAbilityMeta: () => ({ value: 'DEX', label: 'Ловкость' }),
  statesBlock: () => null, statesValue: () => [], displayAc: () => 13, badgeClass: () => '', badgeLabel: () => 'ВРАГ',
  npcItem: () => null, avatarStyle: () => ({}), npcHpFormula: () => null,
  hpPercent: () => 100, hpColor: () => 'var(--success)', hpTempValue: () => 0, hpTempPercent: () => 0, hpLabel: () => '10 / 10', npcDsHp: () => ({ current: 10 }), SIDE_OPTIONS: [],
})
window.fetch = async () => Response.json({ items: [] })
window.controls = { state, encounter, player }
createApp({ render: () => h('main', { style: 'padding:20px;max-width:850px' }, [
  h('div', { class: ['campaign-workspace', state.combat && 'campaign-workspace--combat'], style: 'height:80px;overflow:visible' }, h('div', { class: 'workspace-dock workspace-dock--left', style: 'position:relative;top:0;left:0;display:flex;max-height:none;overflow:visible' }, h(SessionParticipantCard, { participant, isDm: true, combatMode: state.combat, combatEditable: true, combatant: player, combatSelected: state.selected, reorderEnabled: true, 'onUpdate:combat-selected': value => { state.selected = value }, 'onDrag-start': () => { state.drags++ } }))),
  h('div', { style: 'margin-top:24px' }, h(EncounterRow, { combatant: npc, section: 'reserve-npc' })),
]) }).use(pinia).provide('applicationEncounter', encounter).provide('encounter', encounter).mount('#app')
