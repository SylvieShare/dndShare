import { describe, expect, it } from 'vitest'
import { hpCalculatorEvent } from './hpCalculatorEvents'

const hp = (current, temp = 0) => ({ current, temp, max: { base: 12, bonuses: [] } })

describe('HP calculator chronicle events', () => {
  it('records damage absorbed by temporary HP and the actual hit-point loss', () => {
    expect(hpCalculatorEvent(hp(10, 3), hp(5), { kind: 'damage', amount: 8 })).toEqual({
      type: 'hp_changed', action: 'Получен урон: 8',
      data: { kind: 'damage', amount: 8, applied: 8, absorbed: 3,
        before: { current: 10, temp: 3, max: 12 }, after: { current: 5, temp: 0, max: 12 } },
    })
  })

  it('records damage absorbed entirely by temporary HP', () => {
    expect(hpCalculatorEvent(hp(10, 3), hp(10, 1), { kind: 'damage', amount: 2 }))
      .toMatchObject({ action: 'Получен урон: 2', data: { applied: 2, absorbed: 2 } })
  })

  it('records only the actual damage when HP reaches zero', () => {
    expect(hpCalculatorEvent(hp(2, 1), hp(0), { kind: 'damage', amount: 10 }))
      .toMatchObject({ action: 'Получен урон: 3', data: { amount: 10, applied: 3, absorbed: 1 } })
  })

  it('records only healing below the maximum and preserves temporary HP', () => {
    expect(hpCalculatorEvent(hp(10, 3), hp(12, 3), { kind: 'heal', amount: 10 }))
      .toMatchObject({ action: 'Восстановлено хитов: 2', data: { amount: 10, applied: 2, absorbed: 0 } })
  })

  it('skips unchanged HP, temporary-HP grants, hit dice and manual settings', () => {
    expect(hpCalculatorEvent(hp(12), hp(12), { kind: 'heal', amount: 3 })).toBeNull()
    expect(hpCalculatorEvent(hp(0), hp(0), { kind: 'damage', amount: 3 })).toBeNull()
    expect(hpCalculatorEvent(hp(10), hp(10, 3), { kind: 'temp', amount: 3 })).toBeNull()
    expect(hpCalculatorEvent(hp(10), hp(5))).toBeNull()
  })
})
