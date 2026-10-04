import { describe, expect, it } from 'vitest'
import { sessionEventDetails, sessionEventTransition } from './sessionEventEntity'
describe('chronicle quantity changes', () => {
  it('shows HP damage and temporary absorption', () => {
    const event = { type: 'hp_changed', data: { absorbed: 3, before: { current: 10, temp: 3 }, after: { current: 5, temp: 0 } } }
    expect(sessionEventTransition(event)).toBe('Хиты: 10 → 5, Временные хиты: 3 → 0')
    expect(sessionEventDetails(event)).toBe('Поглощено временными хитами: 3')
  })
  it('shows healing and damage that affects only temporary HP', () => {
    expect(sessionEventTransition({ type: 'hp_changed', data: { before: { current: 5, temp: 0 }, after: { current: 12, temp: 0 } } })).toBe('Хиты: 5 → 12')
    expect(sessionEventTransition({ type: 'hp_changed', data: { before: { current: 10, temp: 3 }, after: { current: 10, temp: 1 } } })).toBe('Временные хиты: 3 → 1')
  })
  it('shows the money transfer participants, currency and amount', () => {
    expect(sessionEventDetails({ type: 'money_transfer', data: {
      senderName: 'Лиора', recipientName: 'Торин', currencyName: 'Золотые', amount: 7,
    } })).toBe('Лиора → Торин · 7 Золотые')
  })
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
  it.each([[1, 2, '3 → 2'], [3, 0, '3 → 0'], [1, 0, '1 → 0']])('shows removal of %s items', (count, remaining, expected) => {
    expect(sessionEventTransition({ type: 'item_removed', data: { count, remaining } })).toBe(expected)
  })
  it('lists every stack deleted with an inventory section', () => {
    expect(sessionEventDetails({ type: 'item_removed', data: { removedEntries: [
      { source: { name: 'Факел' }, count: 3, remaining: 0 },
      { source: { name: 'Магический меч' }, count: 1, remaining: 0 },
    ] } })).toBe('Факел (3 → 0) · Магический меч (1 → 0)')
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
    expect(sessionEventTransition({ type: 'item_removed', data: { remaining: 0 } })).toBe('')
  })
})
