import { readFileSync } from 'node:fs'
import { createPinia, setActivePinia } from 'pinia'
import { reactive, ref } from 'vue'
import { beforeEach, expect, it, vi } from 'vitest'
import { availableWeaponUses, completeWeaponUseStep, finishWeaponUse, startWeaponUse, weaponUseError, weaponUseState } from './weaponUses'
import { restoreDawnResources } from './dawnResources'
import { useWeaponUses } from '../blocks/dnd/composables/useWeaponUses'
import { useWeaponUseSteps } from '../blocks/dnd/composables/useWeaponUseSteps'
import { useDiceStore } from '@/stores/dice'
import { useSuggestStore } from '@/stores/suggest'

const sql = readFileSync(new URL('../../../../../internal/store/schema/102_weapon_uses.sql', import.meta.url), 'utf8')
const rule = JSON.parse(sql.split('$lightning_throw$')[1])
const types = [{ id: 9, value: 'Молния', color: '#ff0' }]
const base = { expression: '1d6{Колющий}+3{Колющий}', critical_expression: '2d6{Колющий}+3{Колющий}' }
function fixture(remaining = 1) {
  const item = { id: 284, typeId: 19, name: 'Метательное копьё молнии', data: { max_use: 1, dawn_recovery: { mode: 'full' }, attunement: 'none', weapon_uses: [structuredClone(rule)] } }
  const row = uid => ({ uid, item_id: 1448, magic_item_id: 284, params: { magic: { remaining } } })
  return { items: new Map([['284', item]]), item, values: { lvl: { level: 5 }, weapon: [row('a'), row('b')] } }
}
const start = f => startWeaponUse(f.values, f.items, 'a', rule.key, base, types)
beforeEach(() => setActivePinia(createPinia()))
it('pays one use at attack time, preserves another copy and snapshots independent area/hit damage', () => {
  const f = fixture(), plan = start(f)
  expect(plan.error).toBe('')
  expect(f.values.weapon[0].params.magic.remaining).toBe(1)
  expect(plan.patch.weapon[0].params.magic.remaining).toBe(0)
  expect(plan.patch.weapon[1]).toEqual(f.values.weapon[1])
  expect(plan.event).toMatchObject({ status: 'active', range_ft: 120, resource_cost: 1 })
  expect(plan.event.steps[0]).toMatchObject({ expression: '4d6{Молния|#ff0}', critical_expression: '4d6{Молния|#ff0}', area: { length_ft: 120, width_ft: 5 }, save: { ability: 2, dc: 13, half: true } })
  expect(plan.event.steps[1]).toMatchObject({ expression: '1d6{Колющий}+3{Колющий}+4d6{Молния|#ff0}', critical_expression: '2d6{Колющий}+3{Колющий}+8d6{Молния|#ff0}' })
  f.item.data.weapon_uses[0].steps[0].dice_count = 99
  expect(plan.event.steps[0].dice_count).toBe(4)
})
it('keeps line damage available on a miss and rounds half damage down without spending twice', () => {
  const f = fixture(), plan = start(f)
  let values = { ...f.values, ...plan.patch }
  values = { ...values, ...completeWeaponUseStep(values, 'a', plan.event.id, 'target', null) }
  expect(weaponUseState(values, 'a').steps[0].status).toBe('pending')
  values = { ...values, ...completeWeaponUseStep(values, 'a', plan.event.id, 'line', { total: 15 }, true) }
  expect(weaponUseState(values, 'a').steps[0]).toMatchObject({ status: 'rolled', half_result: 7, critical: false })
  expect(values.weapon[0].params.magic.remaining).toBe(0)
  expect(completeWeaponUseStep(values, 'a', plan.event.id, 'line', { total: 24 })).toEqual({})
  expect(completeWeaponUseStep(values, 'a', 'stale', 'target', null)).toEqual({})
})
it('persists on move/reload, finishes without refund, then recovers only on dawn', () => {
  const f = fixture(), plan = start(f)
  let values = JSON.parse(JSON.stringify({ lvl: f.values.lvl, weapon: [], items: { equipped: [], sections: [{ items: plan.patch.weapon }] } }))
  expect(weaponUseState(values, 'a').id).toBe(plan.event.id)
  values = { ...values, ...finishWeaponUse(values, 'a', plan.event.id) }
  expect(weaponUseState(values, 'a').status).toBe('completed')
  expect(finishWeaponUse(values, 'a', plan.event.id)).toEqual({})
  expect(values.items.sections[0].items[0].params.magic.remaining).toBe(0)
  const dawn = restoreDawnResources(values, f.items)
  expect(dawn.patch.items.sections[0].items[0].params.magic.remaining).toBe(1)
})
it('rejects unavailable resources, inactive items, readers and an unfinished previous use', () => {
  const f = fixture(0)
  expect(start(f).error).toContain('Недостаточно')
  f.values.weapon[0].params.magic.remaining = 1
  expect(startWeaponUse(f.values, f.items, 'a', rule.key, base, types, false).error).toBeTruthy()
  const plan = start(f), next = { ...f.values, ...plan.patch }
  next.weapon[0].params.magic.remaining = 1
  expect(availableWeaponUses(next, f.items, 'a')[0].error).toContain('Завершите')
  f.values.weapon[0].params.magic.lost = true
  expect(start(f).patch).toEqual({})
})
it('queues last-charge checks in the same patch without removing prepaid follow-ups', () => {
  const f = fixture()
  f.item.data.last_charge = { dice: 'd20', failure_max: 1, consequence: 'lose_magic' }
  const plan = start(f)
  expect(plan.patch.weapon[0].params.magic.last_charge_check.status).toBe('pending')
  expect(plan.patch.weapon[0].params.magic.weapon_use.status).toBe('active')
})
it('starts only once, passes the normal attack calculation, and resolves hits from prepaid snapshots', async () => {
  const f = fixture(), ctx = reactive({ ownerMode: true, values: f.values, characterResources: { itemsById: f.items }, updateValues(patch) { this.values = { ...this.values, ...patch } }, logSessionEvent: vi.fn() })
  useSuggestStore().set(12, types)
  const attack = vi.fn(() => ({ total: 25, parts: [{ kind: 'dice', sides: 20, rolls: [3, 20], keptIndex: 1 }] }))
  const use = useWeaponUses(ctx, { title: () => f.item.name, prepare: entry => ({ ...base, entry, critical_threshold: 20 }), attack })
  await Promise.all([use.start(ctx.values.weapon[0], rule.key, 'advantage'), use.start(ctx.values.weapon[0], rule.key, 'advantage')])
  expect(attack).toHaveBeenCalledTimes(1)
  expect(attack.mock.calls[0][4]).toBe('advantage')
  expect(weaponUseState(ctx.values, 'a').critical).toBe(true)
  const steps = useWeaponUseSteps(ctx, ref('a')), dice = useDiceStore()
  const roll = vi.spyOn(dice, 'roll').mockReturnValue({ total: 30 })
  await Promise.all([steps.resolve('target', true), steps.resolve('target', true)])
  expect(roll).toHaveBeenCalledTimes(1)
  expect(roll.mock.calls[0][1]).toContain('8d6')
  expect(ctx.values.weapon[0].params.magic.remaining).toBe(0)
  ctx.ownerMode = false
  await steps.resolve('line')
  expect(roll).toHaveBeenCalledTimes(1)
})
it('validates step identities, costs, dice and save/area dependencies', () => {
  expect(weaponUseError(rule)).toBe('')
  for (const patch of [{ resource_cost: -1 }, { range_ft: 0 }, { steps: [] }, { steps: [rule.steps[0], rule.steps[0]] }, { steps: [{ ...rule.steps[0], save: { ability: 2, dc: 0 } }] }, { steps: [{ ...rule.steps[0], kind: 'weapon_damage' }] }]) expect(weaponUseError({ ...rule, ...patch })).toBeTruthy()
})

it('a natural-one reroll updates the paid attack without another spend or reopening finished uses', async () => {
  const f = fixture(), ctx = reactive({ ownerMode: true, values: f.values, characterResources: { itemsById: f.items }, updateValues(patch) { this.values = { ...this.values, ...patch } }, logSessionEvent: vi.fn() })
  const attack = vi.fn(() => ({ total: 6, parts: [{ kind: 'dice', sides: 20, rolls: [1] }] }))
  const use = useWeaponUses(ctx, { title: () => f.item.name, prepare: entry => ({ ...base, entry, critical_threshold: 20 }), attack })
  await use.start(ctx.values.weapon[0], rule.key)
  const onReroll = attack.mock.calls[0][3], next = { total: 25, parts: [{ kind: 'dice', sides: 20, rolls: [20] }] }
  onReroll(next)
  expect(weaponUseState(ctx.values, 'a')).toMatchObject({ attack_result: next, critical: true })
  expect(ctx.values.weapon[0].params.magic.remaining).toBe(0)
  ctx.updateValues(finishWeaponUse(ctx.values, 'a', weaponUseState(ctx.values, 'a').id))
  ctx.logSessionEvent.mockClear()
  onReroll(next)
  expect(ctx.logSessionEvent).not.toHaveBeenCalled()
})
