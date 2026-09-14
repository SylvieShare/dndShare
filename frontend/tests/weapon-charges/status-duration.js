import '@sylvieshare/share-ui/styles.css'
import '../../src/app/theme.css'
import { createApp, h, reactive } from 'vue'
import { createPinia } from 'pinia'
import DndStatusOverview from '../../src/features/character-editor/blocks/dnd/DndStatusOverview.vue'
import DndMobileStatusMenu from '../../src/features/character-editor/blocks/dnd/DndMobileStatusMenu.vue'
import PotionShelf from '../../src/features/character-editor/blocks/dnd/components/PotionShelf.vue'
import { addStatusInstance, collectCharacterStatuses, setStatusInstanceDuration } from '../../src/features/character-editor/lib/characterStatuses'

const query = new URLSearchParams(location.search)
const effect = { id: 7, name: 'Ускорение', typeId: 15, data: { duration: { kind: 'minutes', value: 10 }, thesis: 'Скорость увеличена', stacking: 'multiple' } }
const items = new Map([['7', effect]])
const values = reactive({ states: addStatusInstance({}, effect, { params: { bonus: 2 }, source: { kind: 'potion', item_id: 100, label: 'Зелье скорости' } }) })
values.states = addStatusInstance(values, effect, { duration: { kind: 'hours', value: 1 } })
const ctx = reactive({ ownerMode: !query.has('reader'), characterStatuses: {
  get entries() { return collectCharacterStatuses(values, items) },
  setDuration: (uid, duration) => setStatusInstanceDuration(values, uid, duration),
} })
const updates = []
window.fixture = { values, ctx, effect, updates }
const app = createApp({ setup() {
  return () => h('main', { style: 'max-width:800px;margin:12px' }, [
    h(query.has('mobile') ? DndMobileStatusMenu : DndStatusOverview, {
      block: { id: 'statuses' }, values,
      'onUpdate:value': (key, value) => { values[key] = value; updates.push(key) },
    }),
    h(PotionShelf, { potions: [{ uid: 'potion', name: 'Зелье скорости', count: 2 }], canUse: ctx.ownerMode }),
  ])
} })
app.use(createPinia())
app.provide('charCtx', ctx)
app.mount('#app')
