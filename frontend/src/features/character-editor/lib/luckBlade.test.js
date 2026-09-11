import { afterEach, expect, it, vi } from 'vitest'
import { computed, effectScope, ref } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { readFileSync } from 'node:fs'
import { initializeItemCharges, initialChargeStocks } from '@/shared/lib/itemInitialCharges'
import { createWeaponInstance, intrinsicWeaponBonus } from './magicWeapons'
import { collectCharacterResources, restoreCharacterResources } from './characterResources'
import { collectCharacterDerivedEffects, derivedNumericBonus } from './characterDerivedEffects'
import { confirmItemUse, confirmedItemUses } from './confirmedItemUses'
import { restoreDawnResources } from './dawnResources'
import { useCharacterCombatEffects } from '../composables/useCharacterCombatEffects'
import { useDiceStore } from '@/stores/dice'
const sql = readFileSync(new URL('../../../../../internal/store/schema/107_luck_blade_rules.sql', import.meta.url), 'utf8')
const data = Object.fromEntries(['use_resources', 'confirmed_uses', 'derived_effects', 'roll_triggers'].map(key => [key, JSON.parse(sql.split(`$${key}$`)[1])]))
const item = { id: 171, typeId: 19, name: 'Клинок удачи', data: { ...data, weapon: { base_item_id: 49, magic_bonus: 1 }, activation: 'carried', attunement: 'required' } }
const items = new Map([['171', item]])
function make(wishes = 3) { return { lvl: { level: 5 }, weapon: ['one','two'].map(uid => createWeaponInstance(item, { uid, item_id: 171, count: 1, params: initializeItemCharges({ magic: { attuned: true } }, wishes, 'wishes') })) } }
const saveBonus = values => derivedNumericBonus(collectCharacterDerivedEffects(values, items), 'save_bonus', values).total
const ownUse = (values, key) => confirmedItemUses(values, items, 'one').find(row => row.key === key)
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers() })
it('keeps independent starting stocks, including zero, and named resource state on initialization', () => {
 expect(initialChargeStocks(item.data)).toMatchObject([{ key: 'wishes', rule: { formula: '1к4−1' } }])
 const values = make(0)
 expect(ownUse(values, 'wish').error).toContain('Недостаточно')
 expect(ownUse(values, 'luck').resource).toMatchObject({ value: 1, total: 1 })
 expect(initializeItemCharges(values.weapon[0].params, 3, 'wishes')).toEqual(values.weapon[0].params)
 const updated = initializeItemCharges(values.weapon[0].params, 2, 'other_stock')
 expect(updated.magic.resource_maxima).toEqual({ wishes: 0, other_stock: 2 })
 expect(updated.magic.resource_counts).toEqual({ wishes: 0, other_stock: 2 })
})
it('uses rule-local activation: saves and luck while carried, wish while equipped; attunement applies to all', () => {
 const values = make(); values.weapon.pop()
 expect(saveBonus(values)).toBe(1)
 const entry = values.weapon.pop(); values.items = { sections: [{ items: [entry] }] }
 expect(saveBonus(values)).toBe(1)
 expect(ownUse(values, 'luck').error).toBe('')
 expect(ownUse(values, 'wish')).toBeUndefined()
 // Overrides work even when the source itself normally requires equipment.
 const strict = new Map([['171', { ...item, data: { ...item.data, activation: 'equipped' } }]])
 expect(derivedNumericBonus(collectCharacterDerivedEffects(values, strict), 'save_bonus', values).total).toBe(1)
 entry.params.magic.attuned = false
 expect(saveBonus(values)).toBe(0)
 expect(confirmedItemUses(values, items, 'one')).toEqual([])
})
it('pays and starts waiting atomically; dawn clears waiting without restoring wishes, also while stowed', () => {
 let values = make()
 values = { ...values, ...confirmItemUse(values, items, 'one', 'wish', true) }
 expect(values.weapon[0].params.magic).toMatchObject({ resource_counts: { wishes: 2 }, use_cooldowns: { wish: 1 } })
 expect(values.weapon[1].params.magic.resource_counts.wishes).toBe(3)
 expect(confirmItemUse(values, items, 'one', 'wish', true)).toEqual({})
 values = { ...values, ...confirmItemUse(values, items, 'one', 'luck', true) }
 for (const kind of ['short','long']) values = { ...values, ...restoreCharacterResources(values, items, kind).patch }
 expect(ownUse(values, 'luck').resource.value).toBe(0)
 expect(ownUse(values, 'wish').cooldown).toBe(1)
 const row = values.weapon.shift(); values.items = { sections: [{ items: [row] }] }
 values = JSON.parse(JSON.stringify(values))
 const result = restoreDawnResources(values, items)
 expect(result.cooldowns).toMatchObject([{ uid: 'one', key: 'wish', before: 1, after: 0 }])
 values = { ...values, ...result.patch }
 expect(ownUse(values, 'luck').resource.value).toBe(1)
 expect(values.items.sections[0].items[0].params.magic.resource_counts.wishes).toBe(2)
 expect(values.items.sections[0].items[0].params.magic.use_cooldowns).toEqual({})
 expect(restoreDawnResources(values, items).cooldowns).toEqual([])
})
it('depleting wishes retains the permanent weapon bonus, saves and luck', () => {
 let values = make(1); values.weapon.pop()
 values = { ...values, ...confirmItemUse(values, items, 'one', 'wish', true) }
 values = { ...values, ...restoreDawnResources(values, items).patch }
 expect(intrinsicWeaponBonus(values.weapon[0], item, values)).toBe(1)
 expect(saveBonus(values)).toBe(1)
 expect(ownUse(values, 'luck').resource.value).toBe(1)
 expect(ownUse(values, 'wish').resource).toMatchObject({ value: 0, total: 1 })
 expect(confirmItemUse(values, items, 'one', 'wish', true)).toEqual({})
})
function rolls() {
 setActivePinia(createPinia()); vi.useFakeTimers()
 const values = ref(make()), scope = effectScope(), dice = useDiceStore()
 const ctx = { ownerMode: true, updateValues: patch => { values.value = { ...values.value, ...patch } } }
 const combat = scope.run(() => useCharacterCombatEffects(values, computed(() => items), ctx))
 const roll = () => dice.rollD20('Проверка силы', 3, 'normal', { log: false, roll_triggers: combat.rollTriggers('ability_check') })
 return { values, scope, dice, ctx, combat, roll }
}
it('rerolls any result, spends the linked resource once and forces the second result, also after popup expires', () => {
 const h = rolls(); h.values.value.weapon.pop()
 vi.spyOn(Math, 'random').mockReturnValueOnce(.9).mockReturnValueOnce(0)
 expect(h.roll().total).toBe(22)
 const id = h.dice.lastD20.id
 vi.advanceTimersByTime(7000)
 expect(h.dice.stack).toEqual([])
 const second = h.dice.runAction(id, 'reroll')
 expect(second.total).toBe(4)
 expect(h.dice.lastD20.actions).toEqual([])
 expect(h.dice.runAction(id, 'reroll')).toBeNull()
 expect(ownUse(h.values.value, 'luck').resource.value).toBe(0)
 h.scope.stop(); h.dice.clear()
})
it('rechecks stale buttons for stock, permission, item removal and unmounted character', () => {
 for (const invalidate of [h => h.ctx.ownerMode = false, h => h.values.value.weapon = [], h => h.values.value = { ...h.values.value, ...confirmItemUse(h.values.value, items, 'one', 'luck', true) }, h => h.scope.stop()]) {
  const h = rolls(); h.values.value.weapon.pop(); h.roll()
  const id = h.dice.lastD20.id; invalidate(h)
  expect(h.dice.runAction(id, 'reroll')).toBeNull()
  h.scope.stop(); h.dice.clear()
 }
})
