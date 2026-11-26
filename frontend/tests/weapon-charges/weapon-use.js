import { h, reactive } from 'vue'
import { lightningThrow, weaponUseField } from '../fixtures/mechanics.js'
import WeaponUsePanel from '../../src/features/character-editor/blocks/dnd/components/WeaponUsePanel.vue'
import WeaponUseEditor from '../../src/features/items/editor/WeaponUseEditor.vue'
import { mountWeaponFixture, weaponItem } from './roll-fixture'

const base = weaponItem(1448, 'Метательное копьё', 'd6', { tags: [6], range_min: 30, range_max: 120 })
const item = { id: 284, typeId: 19, name: 'Метательное копьё молнии', data: {
  weapon: { base_item_id: base.id }, attunement: 'none', max_use: 1, weapon_uses: [lightningThrow],
} }
const blessing = { id: 4656, name: 'Благословение', typeId: 15, data: {
  derived_effects: [{ kind: 'roll_bonus', formula: '1d4', scopes: ['attack', 'saving_throw'] }],
} }
const blessed = new URLSearchParams(location.search).has('bless')
const editorData = reactive(structuredClone(item.data))
window.damageRolls = []
mountWeaponFixture({
  storageKey: blessed ? 'blessed-weapon-use' : 'weapon-use-state',
  weapons: [{ uid: 'javelin', item_id: base.id, magic_item_id: item.id, proficient: true, params: { magic: { remaining: 1 } } }],
  items: [base, item, blessing],
  initialValues: blessed ? { states: [{ uid: 'bless', effect_id: blessing.id }] } : {},
  editorData,
  renderEditor: () => h(WeaponUseEditor, { data: editorData.weapon_uses[0], fields: weaponUseField.fields }),
  createView: ctx => () => !ctx.values.weapon.length && h(WeaponUsePanel, { uid: 'javelin' }),
  configureDice(dice) {
    dice.roll = (title, expression) => {
      window.damageRolls.push(expression)
      return { total: 15, parts: [{ kind: 'dice', sides: 6, sign: '+', rolls: [2, 3, 4, 6], color: '#ff0' }] }
    }
  },
})
