import { createApp, h, reactive } from 'vue'
import { createPinia } from 'pinia'
import { createRichNodeHtml } from '@sylvieshare/share-ui'
import DndSpells from '../../../src/features/character-editor/blocks/dnd/DndSpells.vue'
import InputDescription from '../../../src/shared/ui/InputDescription.vue'
import { itemsApi } from '../../../src/shared/api/itemsApi'
import { useItemTypesStore } from '../../../src/stores/itemTypes'
import { useSuggestStore } from '../../../src/stores/suggest'
import '@sylvieshare/share-ui/styles.css'
import '../../../src/app/theme.css'

const pinia = createPinia()
useSuggestStore(pinia).set(16, [{ id: 4, value: 'Интеллект' }, { id: 6, value: 'Харизма' }])
useItemTypesStore(pinia).types = [{ id: 5, name: 'Заклинания', fields: [] }]
const calculation = createRichNodeHtml('calculation', { formula: 'casting_mod', label: 'Временные хиты' }, 'Временные хиты')
const nested = createRichNodeHtml('item', { id: 11, typeId: 5 }, 'Другое заклинание')
const items = [
  { id: 564, typeId: 5, name: 'Героизм', data: { lvl: 1,
    description: `<p>Получает временные хиты, равные модификатору вашей базовой характеристики. ${calculation}</p><p>${nested}</p>` } },
  { id: 10, typeId: 5, name: 'Врождённый героизм', data: { lvl: 1, description: `<p>${calculation}</p>` } },
  { id: 11, typeId: 5, name: 'Другое заклинание', data: { lvl: 1, description: `<p>${calculation}</p>` } },
]
itemsApi.byIds = async ids => ({ items: items.filter(item => ids.map(Number).includes(item.id)) })
const ctx = reactive({ ownerMode: true, var: { stats: { 4: 3, 6: 1 } } })
const sheet = reactive({ prof_bonus: { v: 3 }, lvl: { level: 5 }, spells: { schema_version: 2,
  slot_pools: { long_rest: [{ level: 1, total: 2, used: 0 }] },
  tabs: [
    { key: 'wizard', name: 'Волшебник', casting_ability: 4, mode: 'known', spells: [{ key: 'wizard-heroism', id: 564 }] },
    { key: 'bard', name: 'Бард', casting_ability: 6, mode: 'known', spells: [{ key: 'bard-heroism', id: 564 }] },
  ],
  grants: [{ key: 'innate-heroism', id: 10, casting_ability: 6, slotless: true, cast_level: 2, source: { label: 'Расовая способность' } }],
} })
const editor = reactive({ value: `<p>После фразы ${calculation}</p>` })
window.sheetValues = sheet
window.spellCtx = ctx
window.descriptionEditor = editor
window.writes = []
createApp({ render: () => h('main', { style: 'max-width:900px;margin:16px' }, [
  h(DndSpells, { block: { id: 'spells', content: { stat_suggest_type_id: 16, prof_bonus_path: 'prof_bonus.v' } },
    value: sheet.spells, values: sheet, 'onUpdate:value': (id, value) => { window.writes.push(value); sheet[id] = value } }),
  h(InputDescription, { block: { id: 'description', title: 'Редактор' }, value: editor.value, editable: true,
    'onUpdate:value': (_id, value) => { editor.value = value } }),
]) }).use(pinia).provide('charCtx', ctx).mount('#app')
