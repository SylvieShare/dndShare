import { readFileSync } from 'node:fs'
import { beforeEach, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { reactive } from 'vue'
import { useDiceStore } from '@/stores/dice'
import { useSuggestStore } from '@/stores/suggest'
import { useWeaponUses } from '../blocks/dnd/composables/useWeaponUses'
import { useWeaponDamageRolls } from '../blocks/dnd/composables/useWeaponDamageRolls'
import { weaponUseDamageActions } from './weaponUseDamage'
import { weaponUseState } from './weaponUses'
import { MAGIC_VALUE_ID } from './characterMagicItems'

const sql = readFileSync(new URL('../../../../../internal/store/schema/102_weapon_uses.sql', import.meta.url), 'utf8')
const rule = JSON.parse(sql.split('$lightning_throw$')[1])
beforeEach(() => setActivePinia(createPinia()))
function fixture(extras = []) {
  const item = { id: 284, typeId: 19, name: 'Копьё', data: { attunement: 'none', max_use: 1, weapon_uses: [rule] } }
  const ctx = reactive({ ownerMode: true,
    values: { lvl: { level: 5 }, weapon: [{ uid: 'a', item_id: 1448, magic_item_id: 284, params: { magic: { remaining: 1 } } }] },
    characterResources: { itemsById: new Map([['284', item]]) },
    updateValues(patch) { this.values = { ...this.values, ...patch } }, logSessionEvent: vi.fn(),
  })
  const base = { expression: '1d6+3', critical_expression: '2d6+3' }, attack = vi.fn()
  useSuggestStore().set(12, [{ id: 9, value: 'Молния', color: '#ff0' }])
  const use = useWeaponUses(ctx, { title: () => item.name, prepare: entry => ({ ...base, entry }), attack })
  const damage = useWeaponDamageRolls(ctx, { item: () => item, propertyItems: () => [], itemTitle: () => item.name,
    weaponDamageActions: entry => [...weaponUseDamageActions(ctx.values, entry.uid), ...extras],
    damagePartsRaw: () => [], damageExpression: () => base.expression, criticalDamageExpression: () => base.critical_expression,
    extraCriticalDice: () => 0, spend: () => true, planWeaponUse: use.plan,
  })
  const roll = vi.spyOn(useDiceStore(), 'roll').mockReturnValue({ total: 15, parts: [] })
  return { ctx, use, damage, attack, roll, entry: () => ctx.values.weapon[0] }
}
it('previews without spending, then pays once for target damage and resolves the flat line', async () => {
  const { ctx, use, damage, attack, roll, entry } = fixture()
  const options = { weaponUseKey: rule.key, critical: true, bonusAction: true, twoHanded: true }
  expect(damage.damagePreview(entry(), options)).toBe('2d6+3+8d6{Молния|#ff0}')
  expect(entry().params.magic.remaining).toBe(1)
  expect(weaponUseState(ctx.values, 'a')).toBeUndefined()
  damage.rollDamage(entry(), options)
  damage.rollDamage(entry(), options)
  expect(roll).toHaveBeenCalledOnce()
  expect(attack).not.toHaveBeenCalled()
  expect(entry().params.magic.remaining).toBe(0)
  expect(weaponUseState(ctx.values, 'a').steps.map(step => step.status)).toEqual(['pending', 'rolled'])
  await use.rollStep(entry(), rule.key, 'line')
  expect(roll.mock.calls[1][1]).toBe('4d6{Молния|#ff0}')
  expect(entry().params.magic.remaining).toBe(0)
  expect(weaponUseState(ctx.values, 'a').steps[0]).toMatchObject({ half_result: 7, critical: false })
  expect(ctx.logSessionEvent.mock.calls.at(-1)[0].data.savingThrow).toMatchObject({ ability: 2, dc: 13, onSuccess: 'half' })
})
it('starts with line damage, prevents a double click and keeps paid target damage after reload', async () => {
  const { ctx, use, damage, roll, entry } = fixture()
  await Promise.all([use.rollStep(entry(), rule.key, 'line'), use.rollStep(entry(), rule.key, 'line')])
  expect(roll).toHaveBeenCalledOnce()
  expect(roll.mock.calls[0][1]).toBe('4d6{Молния|#ff0}')
  ctx.values = JSON.parse(JSON.stringify(ctx.values))
  const action = weaponUseDamageActions(ctx.values, 'a')[0]
  expect(action.label).toBe('Метнуть молнией')
  damage.rollDamage(entry(), { actionKeys: [action.key] })
  expect(roll.mock.calls[1][1]).toBe('1d6+3+4d6{Молния|#ff0}')
  expect(entry().params.magic.remaining).toBe(0)
  await use.rollStep(entry(), rule.key, 'line')
  expect(roll).toHaveBeenCalledTimes(2)
})
it('rejects shared-pool overspending atomically and blocks empty resources and readers', async () => {
  const extra = { key: 'extra', dice: 'd4', dice_count: 1, uses_resource: true, resource_cost: 1,
    resource_owner: { valueId: MAGIC_VALUE_ID, entryKey: 'a' } }
  const { ctx, use, damage, roll, entry } = fixture([extra])
  damage.rollDamage(entry(), { weaponUseKey: rule.key, actionKeys: ['extra'] })
  expect(damage.error.value).toContain('Недостаточно')
  expect(entry().params.magic).toEqual({ remaining: 1 })
  expect(roll).not.toHaveBeenCalled()
  entry().params.magic.remaining = 0
  await use.rollStep(entry(), rule.key, 'line')
  damage.rollDamage(entry(), { weaponUseKey: rule.key })
  expect(roll).not.toHaveBeenCalled()
  entry().params.magic.remaining = 1
  ctx.ownerMode = false
  await use.rollStep(entry(), rule.key, 'line')
  damage.rollDamage(entry(), { weaponUseKey: rule.key })
  expect(roll).not.toHaveBeenCalled()
  expect(entry().params.magic).toEqual({ remaining: 1 })
})
