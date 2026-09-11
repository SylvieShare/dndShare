import '@sylvieshare/share-ui/styles.css'
import '../../src/app/theme.css'
import { createApp, h, reactive, ref, computed } from 'vue'
import { createPinia } from 'pinia'
import { AppModalFrame } from '@sylvieshare/share-ui'
import MagicEquipmentInstanceModal from '../../src/features/items/components/MagicEquipmentInstanceModal.vue'
import WeaponItemMechanics from '../../src/features/character-editor/blocks/dnd/components/WeaponItemMechanics.vue'
import DndDawnEditor from '../../src/features/character-editor/blocks/dnd/components/DndDawnEditor.vue'
import AbilityEditor from '../../src/features/items/editor/AbilityEditor.vue'
import { createWeaponInstance } from '../../src/features/character-editor/lib/magicWeapons'
import { collectCharacterResources, setCharacterResourceAvailable } from '../../src/features/character-editor/lib/characterResources'
import { collectCharacterDerivedEffects, derivedNumericBonus } from '../../src/features/character-editor/lib/characterDerivedEffects'
import { useCharacterCombatEffects } from '../../src/features/character-editor/composables/useCharacterCombatEffects'
import { itemFieldEditorKey } from '../../src/features/character-editor/components/useItemFieldEditor'
import { useDiceStore } from '../../src/stores/dice'
import { itemsApi } from '../../src/shared/api/itemsApi'
import sql from '../../../internal/store/schema/107_luck_blade_rules.sql?raw'
import fields from '../../../resources/items/item_19_shema.json'
const data = Object.fromEntries(['use_resources', 'confirmed_uses', 'derived_effects', 'roll_triggers'].map(key => [key, JSON.parse(sql.split(`$${key}$`)[1])]))
const item = { id: 171, typeId: 19, name: 'Клинок удачи', data: { ...data, weapon: { base_item_id: 49, magic_bonus: 1 }, activation: 'carried', attunement: 'required' } }
const items = new Map([['171', item], ['49', { id: 49, typeId: 1, name: 'Длинный меч', data: {} }]])
itemsApi.byIds = async () => ({ items: [items.get('49')] })
const ctx = reactive({ ownerMode: true, values: JSON.parse(sessionStorage.getItem('luck-blade') || 'null') || { lvl: { level: 5 }, weapon: [] },
 characterResources: { itemsById: items, ensureItems: async () => {}, setAvailable: (key, value) => setCharacterResourceAvailable(ctx.values, items, key, value) },
 updateValues(patch) { this.values = { ...this.values, ...patch }; sessionStorage.setItem('luck-blade', JSON.stringify(this.values)) }, logSessionEvent() {},
})
window.ctx = ctx; window.bonus = () => derivedNumericBonus(collectCharacterDerivedEffects(ctx.values, items), 'save_bonus', ctx.values).total
const pinia = createPinia(), dice = useDiceStore(pinia); window.dice = dice
const editorData = reactive(JSON.parse(JSON.stringify(item.data))); window.editorData = editorData; window.validation = reactive({})
const app = createApp({ setup() {
 const open = ref(false), dawn = ref(false)
 const combat = useCharacterCombatEffects(computed(() => ctx.values), computed(() => items), ctx)
 const roll = () => dice.rollD20('Проверка силы', 3, 'normal', { log: false, roll_triggers: combat.rollTriggers('ability_check') })
 return () => h('main', { style: 'max-width:1000px;margin:8px' }, new URLSearchParams(location.search).has('editor') ? [h(AbilityEditor, { data: editorData, fields, typeId: 19 })] : [
  h('button', { onClick: () => open.value = true }, 'Добавить'), h('button', { onClick: roll }, 'Проверка'), h('button', { onClick: () => dawn.value = true }, 'Рассвет'),
  ctx.values.weapon[0] && h(WeaponItemMechanics, { entry: ctx.values.weapon[0] }),
  open.value && h(MagicEquipmentInstanceModal, { item, onClose: () => open.value = false, onConfirm: params => {
   ctx.updateValues({ weapon: [createWeaponInstance(item, { uid: 'one', item_id: 171, count: 1, params: { ...params, magic: { ...params.magic, attuned: true } } })] }); open.value = false
  } }),
  dawn.value && h(AppModalFrame, { title: 'Рассвет', onClose: () => dawn.value = false }, () => h(DndDawnEditor, { values: ctx.values, onApply: result => ctx.updateValues(result.patch), onClose: () => dawn.value = false })),
 ])
} })
app.use(pinia); app.provide('charCtx', ctx)
app.provide('weaponsBlockCtx', { charCtx: ctx, item: () => item, itemMap: { 171: item }, weaponResources: () => collectCharacterResources(ctx.values, items), toggleWeaponResource() {} })
app.provide(itemFieldEditorKey, { itemData: editorData, zIndex: 4500, itemRefLabel: id => `Предмет ${id}`, ensureItemNames: async () => {}, getSuggests: () => [], getSuggestId: f => f.suggest_id, setValidationError(key, value) { window.validation[String(key)] = value } })
app.mount('#app')
