import { expect, it, vi } from 'vitest'
import { dawnResources, restoreDawnResources, validDawnFormula } from './dawnResources'
import { collectCharacterResources, restoreCharacterResources } from './characterResources'

function fixture(rule = { mode: 'roll', formula: '1к3' }) {
  const items = new Map([['86', { id: 86, typeId: 19, name: 'Посох', data: { max_use: 3, attunement: 'required', dawn_recovery: rule } }]])
  const entry = (uid, remaining, attuned = true) => ({ uid, item_id: 37, magic_item_id: 86, params: { note: 'keep', magic: { remaining, attuned } } })
  const values = { lvl: { level: 4 }, hp: { current: 1 }, spells: { keep: true }, resources: [{ title: 'Short', value: 0, total: 3, short_rest: true }],
    weapon: [entry('first', 1), entry('full', 3)], items: { equipped: [], sections: [{ id: 'bag', items: [entry('stored', 0, false)] }] } }
  return { items, values }
}
it('restores separately per weapon instance and in the bag, caps at maximum, and preserves other state', () => {
  const { items, values } = fixture(), roll = vi.fn().mockReturnValueOnce({ total: 3 }).mockReturnValueOnce({ total: 1 })
  const result = restoreDawnResources(values, items, roll)
  expect(result.error).toBe('')
  expect(roll).toHaveBeenCalledTimes(2)
  expect(result.patch.weapon[0].params).toMatchObject({ note: 'keep', magic: { remaining: 3, attuned: true } })
  expect(result.patch.weapon[1]).toEqual(values.weapon[1])
  expect(result.patch.items.sections[0].items[0].params.magic).toMatchObject({ remaining: 1, attuned: false })
  expect(result.patch).not.toHaveProperty('hp'); expect(result.patch).not.toHaveProperty('spells'); expect(result.patch).not.toHaveProperty('resources')
  expect(values.weapon[0].params.magic.remaining).toBe(1)
  expect(result.results.map(row => [row.before, row.after, row.rolled])).toEqual([[1, 3, 3], [0, 1, 1]])
})
it('does not confuse rests with dawn or interpret textual recharge notes', () => {
  const { values, items } = fixture()
  expect(restoreCharacterResources(values, items, 'long').patch).not.toHaveProperty('weapon')
  expect(restoreCharacterResources(values, items, 'short').patch).not.toHaveProperty('weapon')
  items.get('86').data = { max_use: 3, recharge_note: 'На рассвете 1к3' }
  expect(dawnResources(values, items)).toEqual([])
  expect(restoreDawnResources(values, items).patch).toEqual({})
})
it('fully restores without rolling; nothing rolls again once the pool is full', () => {
  const { values, items } = fixture({ mode: 'full' }), roll = vi.fn()
  const result = restoreDawnResources(values, items, roll)
  expect(roll).not.toHaveBeenCalled()
  expect(result.results.map(row => row.after)).toEqual([3, 3])
  expect(restoreDawnResources({ ...values, ...result.patch }, items, roll).results).toEqual([])
})
it('preserves separate resources on the same instance in one update', () => {
  const { values, items } = fixture()
  items.get('86').data.use_resources = [{ key: 'a', title: 'A', max_use: 3, dawn_recovery: { mode: 'full' } }, { key: 'b', title: 'B', max_use: 2, dawn_recovery: { mode: 'roll', formula: '1' } }]
  values.weapon[0].params.magic.resource_counts = { a: 0, b: 0 }
  const result = restoreDawnResources(values, items)
  expect(result.patch.weapon[0].params.magic.resource_counts).toEqual({ a: 3, b: 1 })
  expect(collectCharacterResources({ ...values, ...result.patch }, items).slice(0, 2).map(row => row.value)).toEqual([3, 1])
})
it('rejects malformed formulas before any random roll or state update', () => {
  const { values, items } = fixture({ mode: 'roll', formula: '1d0' }), roll = vi.fn()
  expect(restoreDawnResources(values, items, roll)).toMatchObject({ patch: {}, results: [] })
  expect(restoreDawnResources(values, items, roll).error).toBeTruthy()
  expect(roll).not.toHaveBeenCalled()
  for (const formula of ['1к3', '1d6 + 1', '3', 'd4', '2d6+1d4']) expect(validDawnFormula(formula)).toBe(true)
  for (const formula of ['1d3garbage', '0d6', '100000d6', '1d0', '-3', '']) expect(validDawnFormula(formula)).toBe(false)
})
