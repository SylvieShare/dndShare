import '@sylvieshare/share-ui/styles.css'
import '../../src/app/theme.css'
import { createApp, h, reactive, computed } from 'vue'
import { createPinia } from 'pinia'
import { RowActionMenu } from '@sylvieshare/share-ui'
import DamageRollOptions from '../../src/features/character-editor/blocks/dnd/components/DamageRollOptions.vue'
import WeaponBonusTransferPanel from '../../src/features/character-editor/blocks/dnd/components/WeaponBonusTransferPanel.vue'
import WeaponBonusTransferEditor from '../../src/features/items/editor/WeaponBonusTransferEditor.vue'
import { intrinsicWeaponBonus } from '../../src/features/character-editor/lib/magicWeapons'
import { collectCharacterDerivedEffects, derivedArmorRules } from '../../src/features/character-editor/lib/characterDerivedEffects'
import { deriveEquippedArmor } from '../../src/features/character-editor/blocks/dnd/lib/equippedArmor'
import { itemFieldEditorKey } from '../../src/features/character-editor/components/useItemFieldEditor'
const item = { id: 233, typeId: 19, name: 'Защитник', data: { weapon: { magic_bonus: 3 }, weapon_bonus_transfer: { title: 'Перенести в защиту', condition: 'При первой атаке своего хода' }, attunement: 'required', activation: 'equipped' } }
const ctx = reactive({ ownerMode: true,
 values: JSON.parse(sessionStorage.getItem('transfer-state') || 'null') || { lvl: { level: 5 }, weapon: [{ uid: 'defender', item_id: 49, magic_item_id: 233, params: { magic: { attuned: true } } }] },
 characterResources: { itemsById: new Map([['233', item]]) },
 updateValues(patch) { this.values = { ...this.values, ...patch }; sessionStorage.setItem('transfer-state', JSON.stringify(this.values)) },
})
window.ctx = ctx; window.attackBonus = null
const editorData = reactive(structuredClone(item.data)); window.editorData = editorData; window.editorError = ''
const app = createApp({ setup() {
 const entry = computed(() => ctx.values.weapon[0])
 const bonus = computed(() => intrinsicWeaponBonus(entry.value, item, ctx.values))
 const ac = computed(() => deriveEquippedArmor(ctx.values, ctx.characterResources.itemsById, () => [], derivedArmorRules(collectCharacterDerivedEffects(ctx.values, ctx.characterResources.itemsById))).total)
 const editorMode = new URLSearchParams(location.search).has('editor')
 return () => h('main', { style: 'max-width:600px;margin:8px' }, editorMode ? [h(WeaponBonusTransferEditor, { data: editorData.weapon_bonus_transfer })] : [
  h('p', { 'data-testid': 'ac' }, `КД: ${ac.value}`),
  entry.value && ctx.ownerMode && h(RowActionMenu, { title: item.name }, {
   trigger: () => h('button', 'Оружие'),
   default: ({ close }) => h(DamageRollOptions, { weaponUid: entry.value.uid, canAttack: true,
    preview: () => `1d8+${3 + bonus.value}`,
    onAttack: () => { window.attackBonus = 5 + bonus.value; close() },
   }),
  }), h(WeaponBonusTransferPanel, { uid: 'defender' }),
 ])
} })
app.use(createPinia()); app.provide('charCtx', ctx)
app.provide(itemFieldEditorKey, { itemData: editorData, setValidationError(key, value) { window.editorError = value } })
app.mount('#app')
