import '@sylvieshare/share-ui/styles.css'
import '../../src/app/theme.css'
import { createApp, h, reactive } from 'vue'
import { createPinia } from 'pinia'
import { createRichNodeHtml } from '@sylvieshare/share-ui'
import DndActions from '../../src/features/character-editor/blocks/dnd/DndActions.vue'
import { richDescriptionRolls } from '../../src/shared/lib/richDescriptionRolls'
import { collectCharacterFeatureActions } from '../../src/features/character-editor/lib/characterFeatureActions'
import { useDiceStore } from '../../src/stores/dice'

const damage = createRichNodeHtml('dice', { formula: '3d10{огонь}', label: 'Урон огнём' }, '3к10')
const description = `<p>Цель получает ${damage} урона.</p>`
const item = { id: 1443, name: 'Дьявольское наследие', data: { feature_actions: [
  { key: 'rebuke', title: 'Адское возмездие', action_type: 'reaction', description, requirements: ['Сл спасброска = 8 + бонус мастерства + модификатор Харизмы.'], resource_key: 'rebuke', resource_cost: 1 },
  { key: 'passive', title: 'Только заряд', action_type: 'special', resource_key: 'passive', resource_cost: 1 },
] } }
const values = reactive({ lvl: { level: 3 }, abilities_race: [{ id: 1443, uid: 'race' }], actions: [{ uid: 'custom', title: 'Своё действие', description, action_type: 'action' }] })
const resources = reactive(['rebuke', 'passive'].map(key => ({ key, title: key, value: 1, total: 1, long_rest: true, source: { valueId: 'abilities_race', entryKey: 'race', resourceKey: key } })))
const ctx = reactive({ ownerMode: true, characterResources: {
  itemsById: new Map([['1443', item]]), resources,
  setAvailable(key, value) { resources.find(row => row.key === key).value = value; return { charges: value } },
} })
window.fixture = { ctx, resources, values, richDescriptionRolls, createRichNodeHtml,
  actions: () => collectCharacterFeatureActions(values, ctx.characterResources.itemsById, resources),
}
const app = createApp({ setup() {
  const dice = useDiceStore()
  window.fixture.dice = dice
  return () => h('main', { style: 'max-width:600px;margin:8px' }, [h(DndActions, {
    block: { id: 'actions' }, value: values.actions, values,
    'onUpdate:value': (key, value) => values[key] = value,
  }), h('output', { 'data-testid': 'rolls' }, String(dice.stack.length))])
} })
app.use(createPinia())
app.provide('charCtx', ctx)
app.mount('#app')
