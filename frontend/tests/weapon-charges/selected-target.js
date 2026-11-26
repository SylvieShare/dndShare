import { h, reactive, ref } from 'vue'
import { AppModalFrame } from '@sylvieshare/share-ui'
import { oathTarget, targetField } from '../fixtures/mechanics.js'
import DndDawnEditor from '../../src/features/character-editor/blocks/dnd/components/DndDawnEditor.vue'
import SelectedTargetEditor from '../../src/features/items/editor/SelectedTargetEditor.vue'
import { mountWeaponFixture, weaponItem } from './roll-fixture'

const bow = weaponItem(61, 'Длинный лук', 'd8', { is_long_range: true })
const sword = weaponItem(49, 'Меч', 'd8')
const item = { id: 202, typeId: 19, name: 'Лук клятвы', data: {
  weapon: { base_item_id: bow.id }, selected_target: oathTarget, attunement: 'required',
} }
const editorData = reactive(structuredClone(item.data))
window.damageRolls = []
mountWeaponFixture({
  storageKey: 'selected-target',
  weapons: [
    { uid: 'bow', item_id: bow.id, magic_item_id: item.id, params: { magic: { attuned: true } } },
    { uid: 'sword', item_id: sword.id },
  ],
  items: [bow, sword, item],
  editorData,
  renderEditor: () => h(SelectedTargetEditor, { data: editorData.selected_target, fields: targetField.fields }),
  configureDice(dice) {
    dice.roll = (title, expression) => {
      window.damageRolls.push(expression)
      return { total: 12, parts: [] }
    }
  },
  createView(ctx) {
    const dawn = ref(false)
    return () => [
      ctx.ownerMode && h('button', { onClick: () => dawn.value = true }, 'Рассвет'),
      dawn.value && h(AppModalFrame, { title: 'Рассвет', onClose: () => dawn.value = false },
        () => h(DndDawnEditor, { values: ctx.values, onApply: result => ctx.updateValues(result.patch), onClose: () => dawn.value = false })),
    ]
  },
})
