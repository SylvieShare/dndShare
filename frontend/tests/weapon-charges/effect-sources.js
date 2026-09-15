import '@sylvieshare/share-ui/styles.css'
import '../../src/app/theme.css'
import { createApp, h, ref } from 'vue'
import { createPinia } from 'pinia'
import ItemEditModal from '../../src/features/character-editor/components/ItemEditModal.vue'
import StatusEffectDetailContent from '../../src/features/items/detail-components/StatusEffectDetailContent.vue'
import { useItemTypesStore } from '../../src/stores/itemTypes'
import { itemsApi } from '../../src/shared/api/itemsApi'
import schema from '../../../internal/store/schema/129_effect_sources.sql?raw'
const fields = JSON.parse(schema.match(/fields=fields\|\|'([\s\S]*?)'::jsonb/)[1])
const pinia = createPinia()
const types = [{ id: 15, name: 'Эффекты', fields }, { id: 5, name: 'Заклинания', fields: [] }]
useItemTypesStore(pinia).types = types
window.testTypes = types
itemsApi.byIds = async () => ({ items: [{ id: 900, name: 'Заклинание-источник', typeId: 5, data: {} }] })
createApp({ setup() {
 const item = ref({ id: 901, userId: 42, name: 'Эффект', typeId: 15, data: { application_sources: [{ item: { id: 900 }, target: 'other', condition: 'После попадания' }] } })
 const edit = ref(false)
 return () => h('main', { style: 'max-width:900px;margin:16px' }, [
 h('button', { onClick: () => edit.value = true }, 'Изменить эффект'),
 h(StatusEffectDetailContent, { item: item.value }),
 edit.value && h(ItemEditModal, { typeId: 15, item: item.value, onClose: () => edit.value = false, onSaved: next => { item.value = next; edit.value = false } }),
 ])
} }).use(pinia).mount('#app')
