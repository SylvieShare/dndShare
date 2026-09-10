import { effectScope, nextTick, reactive, ref } from 'vue'
import { expect, it, vi } from 'vitest'
import { useWeaponEntries } from './useWeaponEntries'

it('saves and unequips an inventory attack without a duplicate or lost charges', async () => {
  const props = reactive({ block: { id: 'weapon' }, value: [{ uid: 'normal', item_id: 49 }], values: { items: { equipped: [{ uid: 'magic', item_id: 100, count: 1, params: { weapon_enabled: true, magic: { attuned: true, remaining: 4 } } }], sections: [] } } })
  const itemMap = ref({ 49: { id: 49, typeId: 1, data: {} }, 100: { id: 100, typeId: 19, data: { weapon: { base_item_id: 49 } } } })
  const charCtx = { updateValues: vi.fn(patch => { if (patch.items) props.values.items = patch.items; if (patch.weapon) props.value = patch.weapon }) }
  const scope = effectScope(), loadItems = vi.fn().mockResolvedValue()
  const state = scope.run(() => useWeaponEntries({ props, emit: vi.fn(), charCtx, itemMap, loadItems }))
  expect(state.entries.value.map(e => e.uid)).toEqual(['normal', 'magic'])
  state.entries.value[1].desc = 'Заметка'
  props.values.items.equipped[0].params.magic.remaining = 1
  state.emitChange()
  await nextTick()
  expect(props.value.map(e => e.item_id)).toEqual([49])
  expect(props.values.items.equipped[0]).toMatchObject({ uid: 'magic', count: 1, params: { magic: { remaining: 1 }, _weapon_state: { desc: 'Заметка' } } })
  const virtual = state.entries.value[1]
  state.hideInventoryWeapon(virtual)
  await nextTick()
  expect(state.entries.value.map(e => e.uid)).toEqual(['normal'])
  expect(props.values.items.equipped[0]).toMatchObject({ uid: 'magic', params: { weapon_enabled: false, magic: { remaining: 1 }, _weapon_state: { desc: 'Заметка' } } })
  props.values.items.equipped[0].params.weapon_enabled = true
  await nextTick()
  expect(state.entries.value[1].desc).toBe('Заметка')
  state.removeInventoryWeapon(state.entries.value[1])
  await nextTick()
  expect(state.entries.value.map(e => e.uid)).toEqual(['normal'])
  expect(props.values.items.sections[0].items[0]).toMatchObject({ uid: 'magic', count: 1, params: { weapon_enabled: false, magic: { remaining: 1 } } })
  scope.stop()
})
