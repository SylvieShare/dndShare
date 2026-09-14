import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, disposePinia, setActivePinia } from 'pinia'
import { useSessionEventsStore } from './sessionEvents'
import { useNotificationsStore } from './notifications'
import { useDiceStore } from './dice'
import * as api from '@/shared/api/sessionEventsApi'
vi.mock('@/shared/api/sessionEventsApi', () => ({ getSessionEvents: vi.fn(), createSessionEvent: vi.fn() }))
const event = (id, status = 'pending') => ({ id, type: 'item_transfer', action: 'Передача: Верёвка', data: { status } })
let pinia
beforeEach(() => { vi.useFakeTimers(); vi.resetAllMocks(); pinia = createPinia(); setActivePinia(pinia) })
afterEach(() => { disposePinia(pinia); vi.useRealTimers() })
describe('session event notifications', () => {
  it('loads history quietly, then notifies each new or changed event exactly once', async () => {
    const events = useSessionEventsStore(), notifications = useNotificationsStore()
    api.getSessionEvents.mockResolvedValueOnce({ events: [event(1)] })
    await events.setContext({ uuid: 'game' })
    expect(notifications.entries).toEqual([])
    expect(events.newEventIds.size).toBe(0)
    api.getSessionEvents.mockResolvedValue({ events: [event(2)], updates: [event(1)] })
    await events.refresh(); await events.refresh()
    expect(notifications.entries).toHaveLength(1)
    expect(events.newEventIds.has(2)).toBe(true)
    api.getSessionEvents.mockResolvedValue({ events: [], updates: [event(2, 'accepted')] })
    await events.refresh(); await events.refresh()
    expect(notifications.entries).toHaveLength(1)
    expect(notifications.entries[0].data).toMatchObject({ updated: true, event: { id: 2, data: { status: 'accepted' } } })
  })
  it('animates while reading the chronicle and suppresses its popup', async () => {
    const events = useSessionEventsStore()
    events.registerReader({ sessionUuid: () => 'game', isReading: () => true })
    api.getSessionEvents.mockResolvedValueOnce({ events: [] }).mockResolvedValueOnce({ events: [event(1)] })
    await events.setContext({ uuid: 'game' }); await events.refresh()
    expect(useNotificationsStore().entries).toEqual([])
    expect(events.newEventIds.has(1)).toBe(true)
    vi.advanceTimersByTime(700)
    expect(events.newEventIds.size).toBe(0)
  })
  it('deduplicates a local dice notification even when SSE wins the race against POST', async () => {
    const events = useSessionEventsStore(), notifications = useNotificationsStore()
    api.getSessionEvents.mockResolvedValue({ events: [] })
    await events.setContext({ uuid: 'game' })
    let finish
    api.createSessionEvent.mockImplementation(() => new Promise(resolve => { finish = resolve }))
    useDiceStore().roll('Атака', 'd20')
    const body = api.createSessionEvent.mock.calls[0][1]
    const incoming = { ...body, id: 10 }
    api.getSessionEvents.mockResolvedValue({ events: [incoming] })
    await events.refresh()
    finish({ event: incoming })
    await Promise.resolve()
    expect(notifications.entries.map(entry => entry.type)).toEqual(['dice'])
    expect(events.newEventIds.has(10)).toBe(true)
  })
  it('recognizes locally displayed results saved through a character transaction', async () => {
    const events = useSessionEventsStore()
    api.getSessionEvents.mockResolvedValue({ events: [] })
    await events.setContext({ uuid: 'game' })
    const result = useDiceStore().roll('Урон', 'd6', { log: false })
    const pending = events.pendingCharacterEvent({ type: 'dice_roll', action: 'Урон', data: { result } })
    api.getSessionEvents.mockResolvedValue({ events: [{ ...pending, id: 1 }] })
    await events.refresh()
    expect(useNotificationsStore().entries).toHaveLength(1)
  })
  it('ignores old transfer baselines but reports their subsequent status changes', async () => {
    const events = useSessionEventsStore()
    api.getSessionEvents.mockResolvedValueOnce({ events: [event(100)] })
      .mockResolvedValueOnce({ events: [], updates: [event(1)] })
      .mockResolvedValueOnce({ events: [], updates: [event(1, 'accepted')] })
    await events.setContext({ uuid: 'game' }); await events.refresh()
    expect(useNotificationsStore().entries).toEqual([])
    await events.refresh()
    expect(useNotificationsStore().entries[0].data.event.id).toBe(1)
    expect(events.events.map(row => row.id)).toEqual([100])
  })
  it('discards responses after leaving and reentering the same session', async () => {
    const events = useSessionEventsStore()
    let finishOld
    api.getSessionEvents.mockImplementationOnce(() => new Promise(resolve => { finishOld = resolve }))
      .mockResolvedValueOnce({ events: [event(2)] })
    const old = events.setContext({ uuid: 'game' })
    events.clearContext()
    await events.setContext({ uuid: 'game' })
    finishOld({ events: [event(1)] }); await old
    expect(events.events.map(row => row.id)).toEqual([2])
    expect(useNotificationsStore().entries).toEqual([])
  })
  it('drains multiple new-event pages with no duplicate notifications', async () => {
    const events = useSessionEventsStore()
    api.getSessionEvents.mockResolvedValueOnce({ events: [event(1)] })
      .mockResolvedValueOnce({ events: Array.from({ length: 100 }, (_, i) => event(i + 2)) })
      .mockResolvedValueOnce({ events: [event(102)] })
    await events.setContext({ uuid: 'game' }); await events.refresh()
    expect(events.events).toHaveLength(102)
    expect(api.getSessionEvents).toHaveBeenLastCalledWith('game', { after: 101, limit: 100 })
    expect(useNotificationsStore().entries).toHaveLength(5)
  })
})
