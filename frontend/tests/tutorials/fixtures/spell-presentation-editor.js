import { createApp, h, reactive } from 'vue'
import { createPinia } from 'pinia'
import CatalogueFields from '../../../src/features/items/editor/catalogue/CatalogueFields.vue'
import DndActionsEditor from '../../../src/features/character-editor/blocks/dnd/components/DndActionsEditor.vue'
import { itemFieldEditorKey } from '../../../src/features/character-editor/components/useItemFieldEditor'
import schema from '../../../../resources/items/item_5_shema.json'
import '@sylvieshare/share-ui/styles.css'
import '../../../src/app/theme.css'
const state = reactive({ data: {}, actions: [{ uid: 'a', title: 'Ритуал', action_type: 'action' }] })
window.editorState = state
createApp({ render: () => h('main', { style: 'padding:20px;max-width:650px' }, [
 h(CatalogueFields, { fields: schema.filter(field => ['time','range'].includes(field.key)), data: state.data, rootData: state.data, typeId: 5, 'onUpdate:data': value => { state.data = value } }),
 h(DndActionsEditor, { actions: state.actions, onChange: (uid, patch) => { state.actions = state.actions.map(row => row.uid === uid ? { ...row, ...patch } : row) } }),
]) }).use(createPinia()).provide(itemFieldEditorKey, { zIndex: 4500, getSuggests: () => [], getSuggestId: () => null }).mount('#app')
