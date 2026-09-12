import '@sylvieshare/share-ui/styles.css'
import '../../src/app/theme.css'
import { createApp, h, ref } from 'vue'
import { createPinia } from 'pinia'
import HandbookItemDetail from '../../src/features/handbook/components/HandbookItemDetail.vue'
import ItemEditModal from '../../src/features/character-editor/components/ItemEditModal.vue'
import { useItemTypesStore } from '../../src/stores/itemTypes'
const query = new URLSearchParams(location.search)
const typeId = Number(query.get('type') || 2)
const type = { id: typeId, name: 'Тестовый справочник', fields: [], instanceFields: [] }
const pinia = createPinia()
useItemTypesStore(pinia).types = [type]
const app = createApp({ setup() {
 const item = ref({ id: 4167, userId: 42, typeId, name: 'Проверяемый предмет', data: {} })
 const editing = ref(false)
 return () => h('main', { style: 'max-width:980px;margin:12px auto' }, [
  h(HandbookItemDetail, { item: item.value, type, canEdit: !query.has('reader'), onEdit: () => editing.value = true }),
  editing.value && h(ItemEditModal, { item: item.value, typeId, onClose: () => editing.value = false, onSaved: saved => item.value = saved }),
 ])
} })
app.use(pinia); app.mount('#app')
