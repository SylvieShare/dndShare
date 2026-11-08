import '@sylvieshare/share-ui/styles.css'
import '../../src/app/theme.css'
import { createApp, h, ref } from 'vue'
import { createPinia } from 'pinia'
import ItemEditModal from '@/features/character-editor/components/ItemEditModal.vue'
import { useItemTypesStore } from '@/stores/itemTypes'
import schema from '../../../resources/items/item_5_shema.json'
import fixtures from '../../../native/fixtures/game-mechanics/effect-bindings.json'

const fixture = fixtures[Number(new URLSearchParams(location.search).get('case') || 0)]
const pinia = createPinia()
const types = [
  { id: 5, sourceId: 1, name: 'Заклинания', fields: schema.filter(field => ['lvl', 'status_effects'].includes(field.key)), instanceFields: [] },
  { id: 15, sourceId: 1, name: 'Эффекты', fields: [], instanceFields: [] },
]
useItemTypesStore(pinia).types = types
window.bindingTypes = types
const storageKey = 'effect-binding-' + fixture.name
const app = createApp({ setup() {
  const item = ref(JSON.parse(localStorage.getItem(storageKey) || 'null'))
  const editing = ref(false)
  return () => h('main', { style: 'max-width:980px;margin:16px auto' }, [
    h('button', { onClick: () => { editing.value = true } }, item.value ? 'Редактировать заклинание' : 'Создать заклинание'),
    editing.value && h(ItemEditModal, { item: item.value, typeId: 5, typeName: 'Заклинания', initialName: fixture.name,
      onClose: () => { editing.value = false },
      onSaved: saved => { item.value = saved; editing.value = false; localStorage.setItem(storageKey, JSON.stringify(saved)) },
    }),
  ])
} })
app.use(pinia).mount('#app')
