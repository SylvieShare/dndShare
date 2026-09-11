import { readFileSync } from 'node:fs'
import { createPinia, setActivePinia } from 'pinia'
import { reactive, ref } from 'vue'
import { beforeEach, expect, it, vi } from 'vitest'
import { collectCharacterResources, setCharacterResourceAvailable, restoreCharacterResources } from './characterResources'
import { bindDamageResources, spendDamageResources } from './weaponDamageResources'
import { collectCharacterCombatEffects } from './characterCombatEffects'
import { inventoryEntries, magicItemActive } from './characterMagicItems'
import { intrinsicWeaponBonus, resolveWeaponItem } from './magicWeapons'
import { restoreDawnResources } from './dawnResources'
import { lastChargeRuleError, resolveLastCharge, undoLastCharge } from './itemLastCharge'
import { useLastChargeCheck } from '../blocks/dnd/composables/useLastChargeCheck'
import { useDiceStore } from '@/stores/dice'

const sql = readFileSync(new URL('../../../../../internal/store/schema/101_item_last_charge.sql', import.meta.url), 'utf8')
const lastCharge = JSON.parse(sql.split('$striking_last_charge$')[1])
const damageSql = readFileSync(new URL('../../../../../internal/store/schema/100_weapon_damage_units.sql', import.meta.url), 'utf8')
const damageRule = JSON.parse(damageSql.split('$striking$')[1])
function fixture(remaining = 3) {
  const item = { id: 189, name: 'Посох ударов', typeId: 19, data: { attunement: 'required', activation: 'equipped', max_use: 10, weapon: { magic_bonus: 3, base_item_id: 37 },
    dawn_recovery: { mode: 'roll', formula: '1d6+4' }, weapon_damage: [damageRule], last_charge: lastCharge } }
  const base = { id: 37, name: 'Боевой посох', typeId: 1, data: { attacks: [{ dice: 'd6', count: 1 }] } }
  const items = new Map([['189', item], ['37', base]])
  const entry = uid => ({ uid, item_id: 37, magic_item_id: 189, params: { magic: { attuned: true, remaining } } })
  return { items, item, values: { lvl: { level: 5 }, weapon: [entry('a'), entry('b')] } }
}
function spend(f) {
  const actions = bindDamageResources(collectCharacterCombatEffects(f.values, f.items).weaponDamage.filter(a => a.weapon_uid === 'a'), collectCharacterResources(f.values, f.items))
  const key = actions[0].key
  return spendDamageResources(f.values, f.items, actions, [key], true, { [key]: 3 })
}
const state = values => inventoryEntries(values).find(row => row.entry.uid === 'a').entry.params.magic
beforeEach(() => setActivePinia(createPinia()))
it('queues one persisted event for the last charge of the correct copy, with a snapshot of its rule', () => {
  const f = fixture(), result = spend(f), next = { ...f.values, ...result.patch }
  expect(result.error).toBe('')
  expect(state(next)).toMatchObject({ remaining: 0, last_charge_check: { status: 'pending', rule: lastCharge } })
  expect(result.patch.weapon[1]).toEqual(f.values.weapon[1])
  expect(state(f.values).last_charge_check).toBeUndefined()
  expect(state(JSON.parse(JSON.stringify(next))).last_charge_check.id).toBeTruthy()
  f.item.data.last_charge = { ...lastCharge, failure_max: 5 }
  expect(state(next).last_charge_check.rule.failure_max).toBe(1)
})
it('does not queue for a non-final spend, preview, or direct counter editing', () => {
  const f = fixture(4)
  expect(state({ ...f.values, ...spend(f).patch }).last_charge_check).toBeUndefined()
  const resource = collectCharacterResources(f.values, f.items)[0]
  const patch = setCharacterResourceAvailable(f.values, f.items, resource.key, 0)
  expect(state({ ...f.values, ...patch }).last_charge_check).toBeUndefined()
})
it('manual spending queues the same event but resource recovery does not create or replace it', () => {
  const f = fixture(1), resource = collectCharacterResources(f.values, f.items)[0]
  const next = { ...f.values, ...setCharacterResourceAvailable(f.values, f.items, resource.key, 0, undefined, true) }
  const check = state(next).last_charge_check
  const dawn = restoreDawnResources(next, f.items, () => ({ total: 5 }))
  expect(state({ ...next, ...dawn.patch }).last_charge_check).toEqual(check)
})
it.each([2, 20])('keeps the item magical on %i and rejects repeat or stale resolution', result => {
  const f = fixture(), next = { ...f.values, ...spend(f).patch }, check = state(next).last_charge_check
  const resolved = { ...next, ...resolveLastCharge(next, 'a', check.id, result) }
  expect(state(resolved)).toMatchObject({ lost: false, remaining: 0, last_charge_check: { status: 'resolved', result } })
  expect(resolveLastCharge(resolved, 'a', check.id, 1)).toEqual({})
  expect(resolveLastCharge(next, 'a', 'stale', 1)).toEqual({})
  expect(resolveLastCharge(next, 'a', check.id, 21)).toEqual({})
})
it('loss removes all mechanics and dawn recovery while preserving base and the other copy; undo restores only magic', () => {
  const f = fixture(), next = { ...f.values, ...spend(f).patch }, check = state(next).last_charge_check
  const lost = { ...next, ...resolveLastCharge(next, 'a', check.id, 1) }, row = lost.weapon[0]
  expect(magicItemActive(f.item, row, true, lost)).toBe(false)
  expect(intrinsicWeaponBonus(row, f.item, lost)).toBe(0)
  expect(resolveWeaponItem(row, Object.fromEntries(f.items))).toMatchObject({ id: 37, name: 'Боевой посох' })
  expect(collectCharacterResources(lost, f.items).every(r => r.source.entryKey !== 'a')).toBe(true)
  expect(collectCharacterCombatEffects(lost, f.items).weaponDamage.every(r => r.weapon_uid !== 'a')).toBe(true)
  const dawn = restoreDawnResources(lost, f.items, () => ({ total: 10 }))
  expect(state({ ...lost, ...dawn.patch }).remaining).toBe(0)
  const rest = restoreCharacterResources(lost, f.items, 'long')
  expect(state({ ...lost, ...rest.patch }).remaining).toBe(0)
  const restored = { ...lost, ...undoLastCharge(lost, 'a', check.id) }
  expect(state(restored)).toMatchObject({ lost: false, remaining: 0, last_charge_check: { status: 'undone', result: 1 } })
  expect(intrinsicWeaponBonus(restored.weapon[0], f.item, restored)).toBe(3)
  expect(undoLastCharge(restored, 'a', check.id)).toEqual({})
  expect(restored.weapon[1]).toEqual(f.values.weapon[1])
})
it('resolves the pending event after moving to inventory and hides it from nonowners', async () => {
  const f = fixture(), next = { ...f.values, ...spend(f).patch }
  const ctx = reactive({ ownerMode: false, values: { weapon: [], items: { equipped: [], sections: [{ items: next.weapon }] } }, updateValues(patch) { this.values = { ...this.values, ...patch } } })
  const controls = useLastChargeCheck(ctx, ref('a')), dice = useDiceStore()
  const roll = vi.spyOn(dice, 'roll').mockReturnValue({ total: 1 })
  await controls.roll()
  expect(roll).not.toHaveBeenCalled()
  ctx.ownerMode = true
  await Promise.all([controls.roll(), controls.roll()])
  expect(roll).toHaveBeenCalledTimes(1)
  expect(state(ctx.values).lost).toBe(true)
  await controls.roll()
  expect(roll).toHaveBeenCalledTimes(1)
})
it('validates dice, dangerous outcomes and supported consequences', () => {
  expect(lastChargeRuleError(lastCharge)).toBe('')
  for (const rule of [{ ...lastCharge, dice: '2d20' }, { ...lastCharge, failure_max: 21 }, { ...lastCharge, failure_max: 0 }, { ...lastCharge, consequence: 'unknown' }]) expect(lastChargeRuleError(rule)).toBeTruthy()
})
