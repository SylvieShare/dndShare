import '@sylvieshare/share-ui/styles.css'
import '../../src/app/theme.css'
import { createApp, h, ref, reactive, computed, provide } from 'vue'
import { createPinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import StepRace from '../../src/features/character-list/components/wizard/steps/StepRace.vue'
import IllustratedChoiceStage from '../../src/features/character-list/components/wizard/IllustratedChoiceStage.vue'
import { extractGrants } from '../../src/features/character-editor/settings/dnd/creation/grants'
import { useItemTypesStore } from '../../src/stores/itemTypes'
import fixture from './data.json'
const params = new URLSearchParams(location.search)
const app = createApp({ setup() {
  const state = reactive({ race: params.has('unselected') ? null : fixture.races.find(r => params.has('gnome2014') ? r.id === 4032 : r.name === (params.has('goliath') ? 'Голиаф' : params.has('elf') ? 'Эльф' : params.has('aasimar') ? 'Аасимар' : 'Гном')), subrace: null, raceVariant: null, asiChoice: [], raceSkillIds: [], featIds: [], raceLangIds: [] })
  const grants = computed(() => extractGrants({ race: state.race, subrace: state.subrace, raceVariant: state.raceVariant, rulesVersion: '2024' }))
  window.state = state
  provide('createWizard', { state, grants, races: ref(fixture.races), subraces: computed(() => (fixture.subraces || []).filter(s => s.data.race === state.race?.id)), loading: ref(false), raceAbilities: ref(fixture.abilities),
    raceSkillOptions: ref([]), raceSkillLimit: ref(1), toggleRaceSkill: () => {},
    raceSubraceNames: () => [], suggestValue: () => '', raceLangOptions: ref([]), raceLangLimit: ref(0), toggleRaceLang: () => {}, raceLangsComplete: ref(true),
    featPool: ref([]), featLimit: ref(0), toggleFeat: () => {}, setFeatSelection: () => {}, featEligibility: () => true, featComplete: ref(true), raceFeatureChoices: ref([]),
  })
  const selected = ref(true)
  return () => h('main', { style: 'max-width:1000px;margin:auto;padding:16px' }, params.has('stage')
    ? h(IllustratedChoiceStage, { title: params.get('stage'), selected: selected.value, selectionKey: 1, backText: 'К выбору', onClear: () => { selected.value = false } }, {
      cards: () => h('div', { class: 'fixture-cover', style: 'height:220px;background:var(--surface)' }, 'Обложка'),
    }) : h(StepRace))
} })
const pinia = createPinia()
useItemTypesStore(pinia).types = [{ id: 3, name: 'Расовые способности', fields: [{ key: 'desc', name: 'Описание', type: 'description' }] }]
const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: { render: () => null } }] })
app.use(pinia).use(router).mount('#app')
