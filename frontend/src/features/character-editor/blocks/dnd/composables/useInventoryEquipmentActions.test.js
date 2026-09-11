import { effectScope, reactive, ref } from 'vue'
import { expect, it, vi } from 'vitest'
import { useInventoryEquipmentActions } from './useInventoryEquipmentActions'
import { appendInventoryEntry, weaponEntryToOwnedEntry } from '../lib/itemPlacement'

function setup(variable = false) {
  const row = { uid: 'first', item_id: 100, count: 1, params: { magic: { attuned: true, remaining: 3 } }, desc: 'Заметка', add_attacks: [] }
  const model = ref({ equipped: [], sections: [{ id: 'bag', name: 'Рюкзак', items: [row, { ...row, uid: 'second', params: {} }] }] })
  const catalog = reactive({ 100: { id: 100, typeId: 19, data: { weapon: variable ? { allowed_base_item_ids: [49, 50] } : { base_item_id: 49 } } }, 49: { id: 49, typeId: 1, data: {} } })
  const charCtx = { values: { weapon: [] }, updateValues: vi.fn(patch => { Object.assign(charCtx.values, patch); model.value = patch.items }) }
  const scope = effectScope()
  const actions = scope.run(() => useInventoryEquipmentActions({ model, catalog, specializedDestinations: ref([]), canManage: ref(true), charCtx, entryTypeId: e => catalog[e.item_id]?.typeId }))
  return { row, model, catalog, charCtx, actions, scope }
}
it('moves the same instance to weapons and back with both sources and all state', () => {
  const { row, model, actions, charCtx, scope } = setup()
  const close = vi.fn()
  actions.moveToSpecialized('bag', row, close)
  expect(close).toHaveBeenCalledOnce()
  expect(model.value.sections[0].items.map(e => e.uid)).toEqual(['second'])
  expect(model.value.equipped).toEqual([])
  const weapon = charCtx.values.weapon[0]
  expect(weapon).toMatchObject({ uid: 'first', item_id: 49, magic_item_id: 100, desc: 'Заметка', params: { magic: { attuned: true, remaining: 3 } } })
  actions.moveToSpecialized('bag', row, close)
  expect(charCtx.values.weapon).toHaveLength(1)
  charCtx.updateValues({ weapon: [], items: appendInventoryEntry(model.value, weaponEntryToOwnedEntry(weapon)) })
  const stored = model.value.sections[0].items.find(e => e.uid === 'first')
  expect(stored.magic_item_id).toBe(100)
  actions.moveToSpecialized('bag', stored, close)
  expect(charCtx.values.weapon[0]).toEqual(weapon)
  scope.stop()
})
it('waits for a base and reads current charges at confirmation', () => {
  const { row, model, actions, charCtx, scope } = setup(true)
  actions.moveToSpecialized('bag', row, vi.fn())
  expect(charCtx.values.weapon).toEqual([])
  expect(actions.pendingWeapon.value.item.id).toBe(100)
  model.value.sections[0].items[0].params.magic.remaining = 1
  actions.confirmWeapon({ weapon_base_item_id: 49 })
  expect(charCtx.values.weapon[0]).toMatchObject({ uid: 'first', item_id: 49, magic_item_id: 100, params: { magic: { remaining: 1 } } })
  expect(charCtx.values.weapon[0].params.weapon_base_item_id).toBeUndefined()
  expect(actions.pendingWeapon.value).toBeNull()
  scope.stop()
})
