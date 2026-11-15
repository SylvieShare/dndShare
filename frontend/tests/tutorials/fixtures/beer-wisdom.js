import { computed, createApp, h, reactive, ref } from 'vue'
import { createPinia } from 'pinia'
import '@sylvieshare/share-ui/styles.css'
import '../../../src/app/theme.css'
import DndCharStat10 from '../../../src/features/character-editor/blocks/dnd/DndCharStat10.vue'
import { useSuggestStore } from '../../../src/stores/suggest'
import { useDiceStore } from '../../../src/stores/dice'
import { useCharacterDerivedEffects } from '../../../src/features/character-editor/composables/useCharacterDerivedEffects'
import { addStatusInstance, removeStatusInstance } from '../../../src/features/character-editor/lib/characterStatuses'
import { statusValueProjection } from '../../../src/features/character-editor/lib/statusValueProjection'
import { participantDefenses } from '../../../src/features/sessions/lib/participantDefenses'
import beer from './beer-wisdom.json'

const pinia = createPinia()
useSuggestStore(pinia).set(16, [{ id: 5, value: 'Мудрость', color: 'var(--info)' }])
useSuggestStore(pinia).set(15, [{ id: 10, value: 'Внимание' }])
const values = reactive({ WIS: { value: { base: 16, bonuses: [] }, save_up: true, skills: { 10: { up: 1 } } },
  lvl: { level: 1 }, prof_bonus: { auto: false, v: 2 }, states: [] })
const items = ref(new Map([[String(beer.id), beer]]))
const effective = computed(() => statusValueProjection(values, items.value))
const derived = useCharacterDerivedEffects(effective, items)
window.beerValues = values
window.rolls = []
useDiceStore(pinia).rollD20 = (title, bonus) => window.rolls.push({ title, bonus })
const ctx = reactive({ ownerMode: true, get values() { return effective.value }, characterDerivedEffects: derived })
createApp({ render: () => h('main', { style: 'max-width:340px;padding:16px' }, [
  h('button', { onClick: () => { values.states = addStatusInstance(values, beer) } }, 'Выпить пиво'),
  h('button', { onClick: () => { values.states = removeStatusInstance(values, values.states[0]?.uid) } }, 'Снять состояние'),
  h(DndCharStat10, { block: { id: 'WIS', content: { title: { suggest_type_id: 16, suggest_id: 5 }, suggest_type_id: 15, suggest_ids: [10], prof_bonus_path: 'prof_bonus.v' } },
    value: values.WIS, values, vars: {}, 'onUpdate:value': (key, value) => { values[key] = value } }),
  h('output', { 'data-testid': 'passive' }, String(participantDefenses(values, items.value).passives[0].value)),
  h('output', { 'data-testid': 'states' }, String(values.states.length)),
]) }).use(pinia).provide('charCtx', ctx).mount('#app')
