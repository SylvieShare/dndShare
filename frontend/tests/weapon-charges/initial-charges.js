import '@sylvieshare/share-ui/styles.css'
import '../../src/app/theme.css'
import { createApp, h, reactive, ref } from 'vue'
import { createPinia } from 'pinia'
import MagicEquipmentInstanceModal from '../../src/features/items/components/MagicEquipmentInstanceModal.vue'
import WeaponItemMechanics from '../../src/features/character-editor/blocks/dnd/components/WeaponItemMechanics.vue'
import MagicItemInstanceModal from '../../src/features/character-editor/blocks/dnd/components/MagicItemInstanceModal.vue'
import AbilityResourceFields from '../../src/features/items/editor/AbilityResourceFields.vue'
import { createWeaponInstance } from '../../src/features/character-editor/lib/magicWeapons'
import { collectCharacterResources } from '../../src/features/character-editor/lib/characterResources'
import { itemFieldEditorKey } from '../../src/features/character-editor/components/useItemFieldEditor'
import { useDiceStore } from '../../src/stores/dice'
import { itemsApi } from '../../src/shared/api/itemsApi'
import sql from '../../../internal/store/schema/106_initial_item_charges.sql?raw'
import fields from '../../../resources/items/item_19_shema.json'
import { RESOURCE_KEYS } from '../../src/features/items/editor/abilityEditorProfile'
const mode = new URLSearchParams(location.search)
const item = { id: 134, typeId: 19, name: 'Похититель девяти жизней', data: { weapon: { base_item_id: 49 }, attunement: 'required', initial_charges: { mode: 'roll', formula: '1к8+1' }, confirmed_uses: [JSON.parse(sql.split('$use$')[1])] } }
if (mode.has('fixed')) item.data.initial_charges = { mode: 'fixed', value: 4 }
if (mode.has('plain')) delete item.data.initial_charges
if (mode.has('no-base')) delete item.data.weapon
itemsApi.byIds = async () => ({ items: [{ id: 49, typeId: 1, name: 'Длинный меч', data: {} }] })
const ctx = reactive({ ownerMode: true, values: JSON.parse(sessionStorage.getItem('initial-charges') || 'null') || { lvl: { level: 5 }, weapon: [] },
 characterResources: { itemsById: new Map([['134', item]]) },
 updateValues(patch) { this.values = { ...this.values, ...patch }; sessionStorage.setItem('initial-charges', JSON.stringify(this.values)) }, logSessionEvent() {},
})
window.ctx = ctx
const pinia = createPinia(), dice = useDiceStore(pinia)
const original = dice.roll; window.rolls = 0
dice.roll = (...args) => { window.rolls++; return original(...args) }
const editorData = reactive(JSON.parse(JSON.stringify(item.data))); window.editorData = editorData; window.editorError = ''
const app = createApp({ setup() {
 const open = ref(false), settings = ref(false)
 return () => h('main', { style: 'max-width:650px;margin:8px' }, mode.has('editor') ? [h(AbilityResourceFields, { data: editorData, fields: fields.filter(field => RESOURCE_KEYS.includes(field.key)) })] : [
  h('button', { onClick: () => open.value = true }, 'Добавить'),
  ctx.values.weapon[0] && h('button', { onClick: () => settings.value = true }, 'Параметры экземпляра'),
  ctx.values.weapon[0] && h(WeaponItemMechanics, { entry: ctx.values.weapon[0] }),
  open.value && h(MagicEquipmentInstanceModal, { item, onClose: () => open.value = false, onConfirm: params => {
   ctx.updateValues({ weapon: [createWeaponInstance(item, { uid: 'one', item_id: 134, count: 1, params: { ...params, magic: { ...params.magic, attuned: true } } })] }); open.value = false
  } }),
  settings.value && h(MagicItemInstanceModal, { item, uid: 'one', values: ctx.values, 'onUpdate:values': patch => ctx.updateValues(patch), onClose: () => settings.value = false }),
 ])
} })
app.use(pinia); app.provide('charCtx', ctx)
app.provide('weaponsBlockCtx', { charCtx: ctx, item: () => item, itemMap: { 134: item }, weaponResources: () => collectCharacterResources(ctx.values, ctx.characterResources.itemsById), toggleWeaponResource() {} })
app.provide(itemFieldEditorKey, { itemData: editorData, getSuggests: () => [], getSuggestId: field => field.suggest_id, setValidationError(key, value) { window.editorError = value } })
app.mount('#app')
