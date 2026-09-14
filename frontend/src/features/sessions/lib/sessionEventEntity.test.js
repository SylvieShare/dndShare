import { describe, expect, it } from 'vitest'
import { sessionEventDetails, sessionEventTransition } from './sessionEventEntity'
describe('chronicle quantity changes', () => {
  it.each([
    ['item_spent', 0, '1 → 0'],
    ['item_added', 4, '3 → 4'],
  ])('shows before and after for %s', (type, remaining, expected) => {
    const event = { type, data: { remaining } }
    expect(sessionEventTransition(event)).toBe(expected)
    expect(sessionEventDetails(event)).toBe('')
  })
  it.each([[-2, 1, '3 → 1'], [3, 5, '2 → 5']])('handles resource delta %s', (delta, remaining, expected) => {
    expect(sessionEventTransition({ type: 'resource_used', data: { resourceChanges: [{ delta, remaining }] } })).toBe(expected)
  })
  it('keeps different resources identifiable when one action affects several', () => {
    expect(sessionEventTransition({ data: { resourceChanges: [
      { name: 'Первый круг', delta: 2, remaining: 3 },
      { name: 'Второй круг', delta: 1, remaining: 2 },
    ] } })).toBe('Первый круг: 1 → 3, Второй круг: 1 → 2')
  })
  it('does not invent quantities for events without them', () => {
    expect(sessionEventTransition({ type: 'resource_used', data: { remaining: 1 } })).toBe('')
    expect(sessionEventTransition({ type: 'item_spent', data: { remaining: null } })).toBe('')
  })
})
