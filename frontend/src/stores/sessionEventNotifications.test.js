import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, disposePinia, setActivePinia } from 'pinia'
import { useSessionEventsStore } from './sessionEvents'
import { useNotificationsStore } from './notifications'
import { useAccountStore } from './account'
import { useDiceStore } from './dice'
import * as api from '@/shared/api/sessionEventsApi'
vi.mock('@/shared/api/sessionEventsApi', () => ({ getSessionEvents: vi.fn(), createSessionEvent: vi.fn() }))
const event = (id, status = 'pending') => ({ id, authorUserId: 2, sessionOwnerUserId: 1, recipientUserId: 1, type: 'item_transfer', action: 'Передача: Верёвка', data: { status } })
let pinia
beforeEach(() => { vi.useFakeTimers(); vi.resetAllMocks(); pinia = createPinia(); setActivePinia(pinia); useAccountStore().user = { id: 1 } })
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
  it('never notifies the author, including events from another device and transfer updates', async () => {
    const events = useSessionEventsStore()
    api.getSessionEvents.mockResolvedValueOnce({ events: [] }).mockResolvedValueOnce({ events: [{ ...event(1), authorUserId: 1 }] })
    await events.setContext({ uuid: 'game' }); await events.refresh()
    api.getSessionEvents.mockResolvedValue({ updates: [{ ...event(1, 'accepted'), authorUserId: 1 }] })
    await events.refresh()
    expect(useNotificationsStore().entries).toEqual([])
  })
  it('players receive only pending item offers addressed to them', async () => {
    useAccountStore().user = { id: 3 }
    const events = useSessionEventsStore()
    api.getSessionEvents.mockResolvedValueOnce({ events: [] }).mockResolvedValueOnce({ events: [
      { ...event(1), type: 'dice_roll', authorUserId: 1 },
      { ...event(2), type: 'resource_used' },
      { ...event(3), recipientUserId: 4 },
      { ...event(4), recipientUserId: 3, authorUserId: 3 },
      { ...event(5, 'accepted'), recipientUserId: 3 },
      { ...event(6), recipientUserId: 3 },
    ] })
    await events.setContext({ uuid: 'game' }); await events.refresh()
    expect(useNotificationsStore().entries.map(entry => entry.data.event.id)).toEqual([6])
  })

  it('does not skip an incoming offer when a newer own action finishes first', async () => {
    useAccountStore().user = { id: 3 }
    const events = useSessionEventsStore()
    api.getSessionEvents.mockResolvedValueOnce({ events: [event(1)] })
      .mockResolvedValueOnce({ events: [{ ...event(2), recipientUserId: 3 }] })
    api.createSessionEvent.mockResolvedValue({ event: { ...event(3), authorUserId: 3, type: 'dice_roll' } })
    await events.setContext({ uuid: 'game' })
    await events.publish({ type: 'dice_roll', action: 'Мой бросок' })
    await events.refresh()
    expect(api.getSessionEvents).toHaveBeenLastCalledWith('game', { after: 1, limit: 100 })
    expect(useNotificationsStore().entries.map(entry => entry.data.event.id)).toEqual([2])
  })

  it('notifies pending offers even if history is unavailable and deduplicates the later journal event', async () => {
    useAccountStore().user = { id: 3 }
    const events = useSessionEventsStore()
    api.getSessionEvents.mockRejectedValueOnce(new Error('history unavailable'))
    await events.setContext({ uuid: 'game' })
    const transfer = { eventId: 20, authorUserId: 2, recipientUserId: 3, sessionOwnerUserId: 1,
      senderName: 'Лиора', recipientName: 'Торин', itemName: 'Верёвка', entry: { item_id: 42 }, status: 'pending' }
    events.notifyTransferOffers('game', [transfer])
    expect(useNotificationsStore().entries).toHaveLength(1)
    api.getSessionEvents.mockResolvedValue({ events: [{ ...event(20), recipientUserId: 3 }] })
    await events.refresh()
    events.notifyTransferOffers('game', [transfer])
    expect(useNotificationsStore().entries).toHaveLength(1)
    useNotificationsStore().clear()
    events.notifyTransferOffers('game', [transfer])
    expect(useNotificationsStore().entries).toEqual([])
  })
  it('shows a pending offer to a player on first load, keeping other history quiet', async () => {
    useAccountStore().user = { id: 3 }
    api.getSessionEvents.mockResolvedValue({ events: [{ ...event(1), recipientUserId: 3 }, { ...event(2, 'accepted'), recipientUserId: 3 }] })
    await useSessionEventsStore().setContext({ uuid: 'game' })
    expect(useNotificationsStore().entries.map(entry => entry.data.event.id)).toEqual([1])
  })
  it('ignores own and other recipients offers from the transfer list', () => {
    const events = useSessionEventsStore()
    events.notifyTransferOffers('game', [
      { eventId: 1, authorUserId: 1, recipientUserId: 1, status: 'pending' },
      { eventId: 2, authorUserId: 2, recipientUserId: 3, status: 'pending' },
    ])
    expect(useNotificationsStore().entries).toEqual([])
  })

  it('notifies directed messages and opponent results without exposing unrelated conversations', async () => {
    useAccountStore().user = { id: 3 }
    const events = useSessionEventsStore()
    const chat = { ...event(20), type: 'chat_message', recipientUserId: 3, data: { message: 'Привет' } }
    const round = { ...event(21), type: 'rps_challenge', authorUserId: 3, recipientUserId: 2 }
    api.getSessionEvents.mockResolvedValueOnce({ events: [round] }).mockResolvedValueOnce({ events: [chat, { ...chat, id: 22, recipientUserId: 4 }] })
    await events.setContext({ uuid: 'game' }); await events.refresh()
    events.notifyInteractionOffers('game', [chat])
    expect(useNotificationsStore().entries.map(entry => entry.data.event.id)).toEqual([20])
    api.getSessionEvents.mockResolvedValue({ events: [], updates: [{ ...round, data: { status: 'completed', resolvedByUserId: 2 } }] })
    await events.refresh()
    expect(useNotificationsStore().entries.map(entry => entry.data.event.id)).toContain(21)
  })
  it('uses the matching reader action and only suppresses the conversation being read', () => {
    useAccountStore().user = { id: 3 }
    const events = useSessionEventsStore()
    const openChat = vi.fn()
    events.registerReader({ sessionUuid: () => 'game', actionFor: event => event.type === 'chat_message' ? { label: 'Чат', run: openChat } : null,
      isReading: event => event.data?.senderCharUuid === 'open-peer' })
    events.registerReader({ sessionUuid: () => 'game', actionFor: () => null })
    events.notifyInteractionOffers('game', [
      { ...event(20), type: 'chat_message', recipientUserId: 3, data: { senderCharUuid: 'open-peer' } },
      { ...event(21), type: 'chat_message', recipientUserId: 3, data: { senderCharUuid: 'another-peer' } },
    ])
    expect(useNotificationsStore().entries).toHaveLength(1)
    expect(useNotificationsStore().entries[0].actions[0].label).toBe('Чат')
  })

})
