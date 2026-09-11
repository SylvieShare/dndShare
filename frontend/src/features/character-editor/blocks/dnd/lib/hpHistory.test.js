import { describe, expect, it } from 'vitest'
import { appendHpHistory, withHpBase, withHpBonuses } from './hp'
import { hpHistoryRows } from './hpHistory'

describe('HP history', () => {
  const firstLevel = { kind: 'level', level: 1, classId: 1, className: 'Воин', classLevel: 1, gain: 12 }

  it('does not invent level gains when only the base is saved', () => {
    expect(hpHistoryRows({ max: { base: 40, bonuses: [] } })).toEqual({
      rows: [{ label: 'База без истории', note: '', value: 40 }], total: 40, incomplete: true,
    })
  })

  it('preserves the unknown base when recording the next level', () => {
    const hp = { max: { base: 40, bonuses: [] } }
    const next = appendHpHistory(hp, { ...firstLevel, level: 5, classLevel: 5, gain: 8 })
    next.max = { ...next.max, base: 48 }
    expect(next.history).toEqual([{ kind: 'untracked', gain: 40 }, { ...firstLevel, level: 5, classLevel: 5, gain: 8 }])
    expect(hp.history).toBeUndefined()
    expect(hpHistoryRows(next).total).toBe(48)
  })

  it('shows class levels separately from total level, manual edits and current bonuses', () => {
    const hp = { max: { base: 18, bonuses: [] }, history: [
      firstLevel, { kind: 'level', level: 2, classId: 2, className: 'Волшебник', classLevel: 1, gain: 6 },
    ] }
    const edited = withHpBonuses(withHpBase(hp, 16), [
      { name: 'Стойкость', value: 4, source_label: 'Черта', source: { sourceId: 'feat' } },
      { name: 'Проклятие', value: -1 },
    ])
    const result = hpHistoryRows(edited)
    expect(result.rows).toEqual([
      { label: 'Воин · 1 ур.', note: 'Уровень персонажа 1', value: 12 },
      { label: 'Волшебник · 1 ур.', note: 'Уровень персонажа 2', value: 6 },
      { label: 'Ручная корректировка', note: '', value: -2 },
      { label: 'Стойкость', note: 'Черта', value: 4 },
      { label: 'Проклятие', note: 'Ручной бонус', value: -1 },
    ])
    expect(result.total).toBe(19)
    expect(result.incomplete).toBe(false)
    expect(hp.history).toHaveLength(2)
    expect(withHpBase(edited, 16).history).toHaveLength(3)
  })

  it('reconciles untracked base edits and a maximum clamped at zero', () => {
    const result = hpHistoryRows({ max: { base: 10, bonuses: [{ value: -15 }] }, history: [firstLevel] })
    expect(result.rows.reduce((sum, row) => sum + row.value, 0)).toBe(result.total)
    expect(result.total).toBe(0)
    expect(result.incomplete).toBe(true)
  })
})
