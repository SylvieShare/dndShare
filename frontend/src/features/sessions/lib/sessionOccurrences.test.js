import { describe, expect, it } from 'vitest'
import { groupOccurrences, preferredOccurrence, localDate, nextOccurrenceNumber, occurrenceDate } from './sessionOccurrences'

describe('campaign schedule', () => {
  const rows = [
    { id: 6, number: 6, date: null },
    { id: 4, number: 4, date: '2026-10-20' },
    { id: 1, number: 1, date: '2026-09-01' },
    { id: 3, number: 3, date: '2026-10-03' },
    { id: 2, number: 2, date: '2026-10-01' },
    { id: 5, number: 5, date: '2026-10-03' },
  ]
  it('selects today first, separates later meetings, and reverses the past', () => {
    const grouped = groupOccurrences(rows, '2026-10-03')
    expect(grouped.next.id).toBe(3)
    expect(grouped.future.map(row => row.id)).toEqual([5, 4])
    expect(grouped.past.map(row => row.id)).toEqual([2, 1])
    expect(grouped.undated.map(row => row.id)).toEqual([6])
    expect(rows[0].id).toBe(6)
  })
  it('opens today or the latest played meeting before future plans', () => {
    expect(preferredOccurrence(rows, '2026-10-03').id).toBe(3)
    expect(preferredOccurrence(rows, '2026-10-02').id).toBe(2)
    expect(preferredOccurrence(rows, '2026-08-01').id).toBe(1)
    expect(preferredOccurrence([], '2026-10-03')).toBeNull()
  })
  it('has no next meeting if only past or undated meetings remain', () => {
    expect(groupOccurrences(rows, '2026-11-01').next).toBeNull()
    expect(groupOccurrences([], '2026-10-03')).toEqual({ next: null, future: [], past: [], undated: [] })
  })
  it('keeps calendar dates in local time and numbers independent of dates', () => {
    expect(localDate(new Date(2026, 9, 3, 0, 1))).toBe('2026-10-03')
    expect(nextOccurrenceNumber(rows)).toBe(7)
    expect(nextOccurrenceNumber([])).toBe(1)
    expect(occurrenceDate('2026-10-03')).toContain('3 октября 2026')
  })
})
