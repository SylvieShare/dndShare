import { ref } from 'vue'
import { expect, it } from 'vitest'
import { useMagicBaseSelection } from './useMagicBaseSelection'
const sword = { id: 1, typeId: 1 }, bow = { id: 2, typeId: 1 }
it('does not create an instance before a loaded, eligible base is selected', () => {
  const item = ref({ typeId: 19, data: { weapon: { allowed_base_item_ids: [1, 2] } } })
  const choice = useMagicBaseSelection(item)
  expect(choice.result()).toBeNull()
  choice.loaded('weapon', [sword, bow])
  expect(choice.result()).toBeNull()
  choice.chosen.weapon_base_item_id = 99
  expect(choice.result()).toBeNull()
  choice.chosen.weapon_base_item_id = 2
  expect(choice.result()).toEqual({ weapon_base_item_id: 2 })
  choice.loaded('weapon', []) // a failed reload cannot confirm an unseen base
  expect(choice.result()).toBeNull()
})
it('automatically selects a sole or fixed base only after it has been loaded', () => {
  const choice = useMagicBaseSelection(ref({ typeId: 19, data: { weapon: { base_item_id: 1 } } }))
  expect(choice.result()).toBeNull()
  choice.loaded('weapon', [bow])
  expect(choice.result()).toBeNull()
  choice.loaded('weapon', [sword])
  expect(choice.result()).toEqual({ weapon_base_item_id: 1 })
})
