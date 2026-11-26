import { h, reactive } from 'vue'
import WeaponBonusTransferEditor from '../../src/features/items/editor/WeaponBonusTransferEditor.vue'
import { deriveEquippedArmor } from '../../src/features/character-editor/blocks/dnd/lib/equippedArmor'
import { mountWeaponFixture, weaponItem } from './roll-fixture'

const base = weaponItem(49, 'Меч', 'd8')
const item = { id: 233, typeId: 19, name: 'Защитник', data: {
  weapon: { base_item_id: base.id, magic_bonus: 3 },
  weapon_bonus_transfer: { title: 'Перенести в защиту', condition: 'При первой атаке своего хода' },
  attunement: 'required', activation: 'equipped',
} }
const editorData = reactive(structuredClone(item.data))
mountWeaponFixture({
  storageKey: 'transfer-state',
  weapons: [{ uid: 'defender', item_id: base.id, magic_item_id: item.id, proficient: true, params: { magic: { attuned: true } } }],
  items: [base, item],
  initialValues: { DEX: { value: { base: 10 } } },
  editorData,
  renderEditor: () => h(WeaponBonusTransferEditor, { data: editorData.weapon_bonus_transfer }),
  createView: ctx => () => h('p', { 'data-testid': 'ac' },
    'КД: ' + deriveEquippedArmor(ctx.values, ctx.characterResources.itemsById, () => [], ctx.characterDerivedEffects.armorRules).total),
})
