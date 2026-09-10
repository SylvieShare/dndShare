import { effectScope, reactive, ref } from 'vue'
import { expect, it, vi } from 'vitest'
import { useInventoryEquipmentActions } from './useInventoryEquipmentActions'
import { clearStowedWeaponFlags } from '@/features/character-editor/lib/inventoryWeapons'
import { equippedMagicWeapons } from '@/features/character-editor/lib/magicWeapons'

function setup(variable = false) {
  const row = { uid: 'first', item_id: 100, count: 1, params: { magic: { attuned: true, remaining: 3 }, _weapon_state: { desc: 'Заметка', add_attacks: [] } } }
  const model = ref({ equipped: [], sections: [{ id: 'bag', name: 'Рюкзак', items: [row, { ...row, uid: 'second', params: {} }] }] })
  const catalog = reactive({ 100: { id: 100, typeId: 19, data: { weapon: variable ? { allowed_base_item_ids: [49, 50] } : { base_item_id: 49 } } }, 49: { id: 49, typeId: 1, data: {} } })
  const charCtx = { values: { weapon: [] }, updateValues: vi.fn(patch => { model.value = patch.items }) }
  const scope = effectScope()
  const actions = scope.run(() => useInventoryEquipmentActions({ model, catalog, specializedDestinations: ref([]), canManage: ref(true), charCtx, entryTypeId: e => catalog[e.item_id]?.typeId }))
  return { row, model, catalog, charCtx, actions, scope }
}
it('moves one instance to weapons and back without duplicating or resetting state', () => {
  const { row, model, catalog, actions, charCtx, scope } = setup()
  const close = vi.fn()
  actions.moveToSpecialized('bag', row, close)
  expect(close).toHaveBeenCalledOnce()
  expect(model.value.sections[0].items.map(e => e.uid)).toEqual(['second'])
  expect(model.value.equipped[0]).toMatchObject({ uid: 'first', params: { weapon_enabled: true, magic: { attuned: true, remaining: 3 }, _weapon_state: { desc: 'Заметка' } } })
  expect(equippedMagicWeapons({ items: model.value }, catalog).map(e => e.uid)).toEqual(['first'])
  expect(charCtx.values.weapon).toEqual([])
  const enabled = model.value.equipped[0]
  actions.moveToSpecialized('equipped', enabled, close)
  expect(model.value.equipped).toHaveLength(1)
  actions.hideWeapon(enabled, close)
  expect(model.value.equipped[0].params.magic.remaining).toBe(3)
  expect(equippedMagicWeapons({ items: model.value }, catalog)).toEqual([])
  actions.moveToSpecialized('equipped', model.value.equipped[0], close)
  expect(equippedMagicWeapons({ items: model.value }, catalog)[0].desc).toBe('Заметка')
  scope.stop()
})
it('waits for a base before moving and preserves charges changed while the picker is open', () => {
  const { row, model, actions, scope } = setup(true)
  actions.moveToSpecialized('bag', row, vi.fn())
  expect(model.value.equipped).toEqual([])
  expect(actions.pendingWeapon.value.item.id).toBe(100)
  model.value.sections[0].items[0].params.magic.remaining = 1
  actions.confirmWeapon({ weapon_base_item_id: 49 })
  expect(model.value.equipped[0]).toMatchObject({ uid: 'first', params: { weapon_enabled: true, weapon_base_item_id: 49, magic: { remaining: 1 } } })
  expect(actions.pendingWeapon.value).toBeNull()
  scope.stop()
})
it('turns off weapon membership when stowed, preserving all other instance data', () => {
  const { row, scope } = setup()
  const inventory = { equipped: [], sections: [{ id: 'bag', items: [{ ...row, params: { ...row.params, weapon_enabled: true } }] }] }
  const result = clearStowedWeaponFlags(inventory)
  expect(result.sections[0].items[0].params).toEqual({ ...row.params, weapon_enabled: false })
  expect(inventory.sections[0].items[0].params.weapon_enabled).toBe(true)
  scope.stop()
})
