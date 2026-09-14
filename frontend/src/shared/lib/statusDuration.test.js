import { describe, expect, it } from 'vitest'
import { cleanStatusDuration, statusDuration, statusDurationError } from './statusDuration'

describe('status duration', () => {
  it.each([
    ['rounds', 1, '1 раунд'], ['rounds', 22, '22 раунда'], ['rounds', 11, '11 раундов'],
    ['minutes', 5, '5 минут'], ['hours', 2, '2 часа'], ['days', 21, '21 день'],
  ])('formats %s and %s', (kind, value, expected) => {
    expect(statusDuration({ kind, value })).toBe(expected)
  })
  it('supports free conditions and compact mobile labels', () => {
    expect(statusDuration({ kind: 'minutes', value: 10 }, { compact: true })).toBe('10 мин.')
    expect(statusDuration({ kind: 'custom', text: ' До конца следующего хода ' })).toBe('До конца следующего хода')
    expect(statusDuration()).toBe('До ручного снятия')
    expect(statusDuration({ kind: 'until_rest' })).toBe('До отдыха')
  })
  it('rejects incomplete or invalid input without silently clamping it', () => {
    for (const value of ['', 0, -1, 0.5, Infinity, NaN, Number.MAX_SAFE_INTEGER + 1]) {
      expect(statusDurationError({ kind: 'minutes', value })).not.toBe('')
    }
    expect(statusDurationError({ kind: 'custom', text: '  ' })).not.toBe('')
    expect(statusDurationError({ kind: 'custom', text: 'x'.repeat(201) })).not.toBe('')
    expect(statusDurationError({ kind: 'unknown' })).not.toBe('')
    expect(statusDurationError({ kind: 'days', value: '2' })).toBe('')
  })
  it('stores only fields that apply to the selected duration', () => {
    expect(cleanStatusDuration({ kind: 'minutes', value: '10', text: 'old' })).toEqual({ kind: 'minutes', value: 10 })
    expect(cleanStatusDuration({ kind: 'manual', value: 10, text: 'old' })).toEqual({ kind: 'manual' })
    expect(cleanStatusDuration({ kind: 'custom', value: 10, text: ' До рассвета ' })).toEqual({ kind: 'custom', text: 'До рассвета' })
  })
})
