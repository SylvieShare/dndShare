import { describe, expect, it } from 'vitest'
import { computeSpellSlotPools } from './multiclassSpellcasting'
import { applySpellSlotChanges } from './applySpellSlotChanges'
import { progressionSlotChanges } from '@/features/items/lib/progressionSlotChanges'

const items = {
  1: { id: 1, data: { caster_progression: 'full' } },
  2: { id: 2, data: { caster_progression: 'half' } },
  3: { id: 3, data: { caster_progression: 'pact' } },
  4: { id: 4, data: {} },
  5: { id: 5, data: { caster_progression: 'half' } },
}
const progression = entries => computeSpellSlotPools(entries, items)
const gains = (before, after) => progressionSlotChanges(progression(after), progression(before))

describe('level-up slot additions', () => {
  it('adds only this level gain, preserving custom totals, circles, pools and usage', () => {
    const changes = gains([{ id: 1, level: 1 }], [{ id: 1, level: 2 }])
    expect(changes).toEqual([{ kind: 'added', level: 1, count: 1, pact: false }])
    const saved = { long_rest: [{ level: 1, total: 9, used: 4 }, { level: 5, total: 2, used: 1 }],
      short_rest: [{ level: 2, total: 3, used: 2 }] }
    const original = structuredClone(saved)
    expect(applySpellSlotChanges(saved, changes)).toEqual({
      long_rest: [{ level: 1, total: 10, used: 4 }, { level: 5, total: 2, used: 1 }],
      short_rest: saved.short_rest,
    })
    expect(saved).toEqual(original)
    expect(applySpellSlotChanges({}, changes).long_rest).toEqual([{ level: 1, total: 1, used: 0 }])
  })

  it('does not refill manually removed slots on a level with no progression gain', () => {
    expect(gains([{ id: 1, level: 3 }], [{ id: 1, level: 4 }]))
      .toEqual([{ kind: 'added', level: 2, count: 1, pact: false }])
    expect(gains([{ id: 2, level: 3 }], [{ id: 2, level: 4 }])).toEqual([])
  })

  it('grants first casting level slots without replacing manually supplied slots', () => {
    const changes = gains([{ id: 2, level: 1 }], [{ id: 2, level: 2 }])
    expect(applySpellSlotChanges({ long_rest: [{ level: 1, total: 1, used: 1 }] }, changes).long_rest)
      .toEqual([{ level: 1, total: 3, used: 1 }])
  })

  it('uses the shared multiclass progression and ignores decreases from rounding', () => {
    expect(gains([{ id: 2, level: 4 }, { id: 1, level: 2 }], [{ id: 2, level: 4 }, { id: 1, level: 3 }]))
      .toEqual([{ kind: 'added', level: 3, count: 2, pact: false }])
    expect(gains([{ id: 2, level: 5 }], [{ id: 2, level: 5 }, { id: 5, level: 1 }])).toEqual([])
    expect(gains([{ id: 1, level: 1 }, { id: 4, level: 1 }], [{ id: 1, level: 1 }, { id: 4, level: 2 }])).toEqual([])
  })

  it('replaces class pact slots while preserving manual extras and spent slots', () => {
    const changes = gains([{ id: 3, level: 2 }], [{ id: 3, level: 3 }])
    expect(changes).toEqual([{ kind: 'upgraded', fromLevel: 1, level: 2, count: 2, pact: true }])
    expect(applySpellSlotChanges({ short_rest: [{ level: 1, total: 3, used: 2 }, { level: 2, total: 1, used: 1 }] }, changes))
      .toEqual({ long_rest: [], short_rest: [{ level: 1, total: 1, used: 0 }, { level: 2, total: 3, used: 3 }] })
    expect(gains([{ id: 3, level: 10 }], [{ id: 3, level: 11 }]))
      .toEqual([{ kind: 'added', level: 5, count: 1, pact: true }])
  })
  it.each([2, 4, 6, 8])('removes the exhausted old pact circle at warlock level %s', (level) => {
    const oldCircle = level / 2
    const saved = { long_rest: [{ level: 1, total: 4, used: 2 }],
      short_rest: [{ level: oldCircle, total: 2, used: 2 }, { level: 9, total: 1, used: 1 }] }
    const original = structuredClone(saved)
    const result = applySpellSlotChanges(saved, gains([{ id: 3, level }], [{ id: 3, level: level + 1 }]))
    expect(result).toEqual({ long_rest: saved.long_rest,
      short_rest: [{ level: oldCircle + 1, total: 2, used: 2 }, { level: 9, total: 1, used: 1 }] })
    expect(saved).toEqual(original)
  })

  it.each([0, 1])('handles manually reduced old pact totals of %s without negative counts', (total) => {
    const changes = gains([{ id: 3, level: 2 }], [{ id: 3, level: 3 }])
    const short_rest = total ? [{ level: 1, total, used: total }] : []
    expect(applySpellSlotChanges({ short_rest }, changes).short_rest)
      .toEqual([{ level: 2, total: 2, used: total }])
  })

  it('retains spent manual extras above the class count in the old circle', () => {
    const changes = gains([{ id: 3, level: 2 }], [{ id: 3, level: 3 }])
    expect(applySpellSlotChanges({ short_rest: [{ level: 1, total: 4, used: 3 }] }, changes).short_rest)
      .toEqual([{ level: 1, total: 2, used: 1 }, { level: 2, total: 2, used: 2 }])
  })

  it('only adds count gains on the same pact circle and leaves unchanged levels alone', () => {
    const saved = { short_rest: [{ level: 5, total: 4, used: 3 }] }
    expect(applySpellSlotChanges(saved, gains([{ id: 3, level: 10 }], [{ id: 3, level: 11 }])).short_rest)
      .toEqual([{ level: 5, total: 5, used: 3 }])
    expect(gains([{ id: 3, level: 11 }], [{ id: 3, level: 12 }])).toEqual([])
  })

})
