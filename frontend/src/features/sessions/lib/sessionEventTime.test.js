import { describe, expect, it } from 'vitest'
import { sessionEventTime } from './sessionEventTime'
describe('chronicle timestamp', () => {
  const now = new Date(2026, 8, 15, 12)
  it('shows only time today', () => expect(sessionEventTime(new Date(2026, 8, 15, 9, 7), now)).toBe('09:07'))
  it('includes the date on other days', () => expect(sessionEventTime(new Date(2026, 8, 14, 9, 7), now)).toBe('14.09, 09:07'))
  it('includes the year when different', () => expect(sessionEventTime(new Date(2025, 8, 15, 9, 7), now)).toBe('15.09.2025, 09:07'))
  it('does not show an invalid date', () => expect(sessionEventTime('bad', now)).toBe(''))
})
