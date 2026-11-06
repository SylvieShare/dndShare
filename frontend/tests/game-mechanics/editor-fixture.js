import { createApp, h, reactive } from 'vue'
import { createPinia } from 'pinia'
import AbilityEditor from '@/features/items/editor/AbilityEditor.vue'
import { itemFieldEditorKey } from '@/features/character-editor/components/useItemFieldEditor'
import { normalizeDataForSave } from '@/features/handbook/objects/lib/schemaFields'
import { collectCharacterDerivedEffects, derivedNumericBonus } from '@/features/character-editor/lib/characterDerivedEffects'
import schema from '../../../resources/items/item_7_shema.json'

const fields = schema.filter(f => f.key === 'derived_effects')
const data = reactive(JSON.parse(sessionStorage.getItem('mechanic') || '{}'))
const values = { lvl: { level: 5 }, abilities_feats: [{ id: 7 }] }
function result(scope) {
  const rules = collectCharacterDerivedEffects(values, new Map([['7', { id: 7, typeId: 7, name: 'Обучение', data }]]))
  return derivedNumericBonus(rules, 'check_bonus', values, { kind: scope }).total
}
const app = createApp({ render: () => h('main', [
  h(AbilityEditor, { fields, data, typeId: 7 }),
  h('button', { onClick: () => sessionStorage.setItem('mechanic', JSON.stringify(normalizeDataForSave(data, fields))) }, 'Сохранить предмет'),
  h('output', { 'aria-label': 'Инициатива на листе' }, result('initiative')),
  h('output', { 'aria-label': 'Проверка на листе' }, result('ability_check')),
]) })
app.use(createPinia()).provide(itemFieldEditorKey, {
  itemData: data, getSuggests: () => [], getSuggestId: f => f.suggest_id, zIndex: 4500,
}).mount('#app')
