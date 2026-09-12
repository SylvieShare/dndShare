import { createApp, h, reactive } from 'vue'
import { createPinia } from 'pinia'
import DndCharStat10 from '../../../src/features/character-editor/blocks/dnd/DndCharStat10.vue'
import { useDiceStore } from '../../../src/stores/dice'
import { useSuggestStore } from '../../../src/stores/suggest'
import '@sylvieshare/share-ui/styles.css'
import '../../../src/app/theme.css'

const pinia = createPinia()
useSuggestStore(pinia).set(16, [{ id: 2, value: 'Ловкость', color: 'var(--accent)' }])
useSuggestStore(pinia).set(17, [{ id: 4, value: 'Скрытность', desc: 'Описание навыка' }])
window.rolls = []
window.writes = []
useDiceStore(pinia).rollD20 = (title, bonus, mode, options) => window.rolls.push({ title, bonus, mode, options })
const state = reactive({
  value: { value: { base: 16, bonuses: [] }, save_up: true, save_bonuses: [{ value: 1 }], skills: { 4: { up: 2 } } },
  checkEffects: [{ mode: 'disadvantage', source: 'Эффект проверки' }],
})
window.statState = state
const ctx = {
  ownerMode: true,
  characterRolls: { effects: ({ kind }) => kind === 'skill_check'
    ? [{ mode: 'advantage', source: 'Способность' }, { mode: 'disadvantage', source: 'Доспех' }]
    : kind === 'saving_throw' ? [{ mode: 'advantage', source: 'Эффект спасброска' }] : state.checkEffects },
  characterCombatEffects: {
    rollTriggers: scope => [{ scope }],
    rollAdjustments: (scope, context) => [{ scope, ...context }],
  },
}
createApp({ render: () => h('main', { style: 'max-width:320px;margin:20px' }, [h(DndCharStat10, {
  block: { id: 'DEX', content: { title: { suggest_type_id: 16, suggest_id: 2 }, suggest_type_id: 17, suggest_ids: [4] },
    props: { variant: window.innerWidth < 640 ? 'mobile' : 'desktop' } },
  value: state.value, values: {}, vars: { stats: { 2: 3 } },
  'onUpdate:value': (...args) => window.writes.push(args),
})]) }).use(pinia).provide('charCtx', ctx).mount('#app')
