import { beforeEach, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { reactive } from 'vue'
import { useDiceStore } from '@/stores/dice'
import { useWeaponDamageRolls } from '../blocks/dnd/composables/useWeaponDamageRolls'
import { weaponUseDamageActions, weaponUseDamageSelection } from './weaponUseDamage'

beforeEach(() => setActivePinia(createPinia()))
function fixture() {
 const ctx = reactive({ ownerMode: true, values: { weapon: [{ uid: 'a', params: { magic: { remaining: 0, weapon_use: {
   id: 'event', title: 'Молния', attack_mode: 'thrown', status: 'active', steps: [
    { key: 'line', kind: 'damage', status: 'pending' },
    { key: 'target', title: 'Урон по цели', kind: 'weapon_damage', status: 'pending', dice: 'd6', dice_count: 4,
      expression: '1d6+3+4d6', critical_expression: '2d6+3+8d6' },
   ],
 } } } }] }, updateValues(patch) { this.values = { ...this.values, ...patch } }, logSessionEvent: vi.fn() })
 const spend = vi.fn(() => true)
 const calc = { item: () => ({}), propertyItems: () => [], itemTitle: () => 'Копьё',
  weaponDamageActions: entry => [...weaponUseDamageActions(ctx.values, entry.uid), { key: 'extra', label: 'Добавка', dice: 'd4', dice_count: 1 }],
  damagePartsRaw: () => [], spend, damageExpression: () => '1d6+3', criticalDamageExpression: () => '2d6+3', extraCriticalDice: () => 0,
 }
 return { ctx, spend, damage: useWeaponDamageRolls(ctx, calc), dice: useDiceStore() }
}
it('previews and rolls paid hit damage once with other additions, while leaving the line pending', () => {
 const { ctx, damage, dice } = fixture(), entry = ctx.values.weapon[0]
 const key = weaponUseDamageActions(ctx.values, 'a')[0].key
 const options = { actionKeys: [key, 'extra'], critical: true }
 expect(damage.damagePreview(entry, options)).toBe('2d6+3+8d6+2d4')
 const roll = vi.spyOn(dice, 'roll').mockReturnValue({ total: 35, parts: [] })
 damage.rollDamage(entry, options); damage.rollDamage(entry, options)
 expect(roll).toHaveBeenCalledTimes(1)
 expect(ctx.values.weapon[0].params.magic.remaining).toBe(0)
 expect(ctx.values.weapon[0].params.magic.weapon_use.steps.map(step => step.status)).toEqual(['pending', 'rolled'])
 expect(damage.error.value).toContain('уже использован')
 expect(weaponUseDamageActions(ctx.values, 'a')).toEqual([])
})
it('rejects foreign or completed steps and readers; ordinary damage stays available', () => {
 const { ctx, damage, dice } = fixture(), entry = ctx.values.weapon[0]
 const key = weaponUseDamageActions(ctx.values, 'a')[0].key
 expect(weaponUseDamageSelection(ctx.values, 'other', [key]).error).toBeTruthy()
 const roll = vi.spyOn(dice, 'roll').mockReturnValue({ total: 6, parts: [] })
 ctx.ownerMode = false; damage.rollDamage(entry, { actionKeys: [key] }); expect(roll).not.toHaveBeenCalled()
 ctx.ownerMode = true; ctx.values.weapon[0].params.magic.weapon_use.status = 'completed'
 damage.rollDamage(entry, { actionKeys: [key] }); expect(roll).not.toHaveBeenCalled()
 damage.rollDamage(entry); expect(roll).toHaveBeenCalledOnce()
 expect(roll.mock.calls[0][1]).toBe('1d6+3')
})
it('a failed extra resource payment leaves prepaid hit damage available', () => {
 const { ctx, damage, dice, spend } = fixture(), entry = ctx.values.weapon[0]
 const key = weaponUseDamageActions(ctx.values, 'a')[0].key
 spend.mockReturnValue(false)
 const roll = vi.spyOn(dice, 'roll')
 damage.rollDamage(entry, { actionKeys: [key] })
 expect(roll).not.toHaveBeenCalled()
 expect(weaponUseDamageActions(ctx.values, 'a')).toHaveLength(1)
})
