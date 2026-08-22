import { describe, expect, it } from 'vitest'
import { collectCharacterHpBonuses } from './characterHitPoints'

describe('character HP bonus sources', () => {
  it('derives a racial per-level bonus from ability data', () => {
    const rows = collectCharacterHpBonuses(
      { lvl: { level: 5 }, abilities_race: [{ id: 7 }] },
      new Map([['7', { id: 7, name: 'Дварфская стойкость', data: { hp_bonuses: [{ per_level: 1 }] } }]]),
    )
    expect(rows).toMatchObject([{ value: 5, readonly: true, source: { category: 'race' } }])
  })
})

