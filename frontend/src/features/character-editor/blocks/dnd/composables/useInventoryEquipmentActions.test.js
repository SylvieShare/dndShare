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
  const actions = scope.run(() => useInventoryEquipmentActions({ model, catalog, specializedDestinations: ref([{ type_id: 1, value_id: 'weapon', label: 'Оружие' }]), canManage: ref(true), charCtx, entryTypeId: e => catalog[e.item_id]?.typeId }))
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

it('moves every weapon in a carried stack once, preserving notes and instance parameters', () => {
  const { row, model, actions, charCtx, scope } = setup()
  Object.assign(row, { item_id: 49, count: 2, params: { magic_bonus: 1 }, proficient: true })
  actions.moveToSpecialized('bag', row, vi.fn())
  expect(model.value.equipped).toEqual([])
  expect(model.value.sections[0].items.map(entry => entry.uid)).toEqual(['second'])
  expect(charCtx.values.weapon).toHaveLength(2)
  expect(new Set(charCtx.values.weapon.map(entry => entry.uid)).size).toBe(2)
  expect(charCtx.values.weapon[0].uid).toBe('first')
  for (const entry of charCtx.values.weapon) expect(entry).toMatchObject({ item_id: 49, desc: 'Заметка', params: { magic_bonus: 1 }, proficient: true })
  scope.stop()
})

it('moves an already equipped weapon directly without losing its remaining charges', () => {
  const { model, actions, charCtx, scope } = setup()
  model.value.equipped.push(model.value.sections[0].items.shift())
  actions.moveToSpecialized('equipped', model.value.equipped[0], vi.fn())
  expect(model.value.equipped).toEqual([])
  expect(charCtx.values.weapon).toHaveLength(1)
  expect(charCtx.values.weapon[0]).toMatchObject({ uid: 'first', item_id: 49, magic_item_id: 100, params: { magic: { attuned: true, remaining: 3 } }, desc: 'Заметка' })
  scope.stop()
})
