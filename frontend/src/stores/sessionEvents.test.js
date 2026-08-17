import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('@/shared/api/sessionEventsApi', () => ({
  getSessionEvents: vi.fn(),
  createSessionEvent: vi.fn(),
}))

import * as api from '@/shared/api/sessionEventsApi'
import { useSessionEventsStore } from './sessionEvents'

describe('session event timeline store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('loads an event context and publishes with its actor character', async () => {
    api.getSessionEvents.mockResolvedValue({ events: [{ id: 1, type: 'rest_completed' }] })
    api.createSessionEvent.mockResolvedValue({ event: { id: 2, type: 'spell_used' } })
    const store = useSessionEventsStore()

    await store.setContext({ uuid: 'session-uuid', actorUuid: 'char-uuid' })
    const pending = store.pendingCharacterEvent({ type: 'rest_completed', action: 'Короткий отдых' })
    await store.publish({ type: 'spell_used', action: 'Использовано: Огненный шар', data: { slotLevel: 3 } })

    expect(api.createSessionEvent).toHaveBeenCalledWith('session-uuid', expect.objectContaining({
      type: 'spell_used',
      actorCharUuid: 'char-uuid',
      actorName: null,
      data: { slotLevel: 3 },
    }))
    expect(store.events.map(event => event.id)).toEqual([1, 2])
    expect(pending).toEqual(expect.objectContaining({
      sessionUuid: 'session-uuid',
      type: 'rest_completed',
      clientActionId: expect.any(String),
    }))
    store.clearContext()
  })

  it('does not publish actions outside a session context', async () => {
    const store = useSessionEventsStore()
    expect(await store.publish({ type: 'dice_roll', action: 'd20' })).toBeNull()
    expect(api.createSessionEvent).not.toHaveBeenCalled()
  })

  it('refreshes only events after the current journal cursor', async () => {
    api.getSessionEvents
      .mockResolvedValueOnce({ events: [{ id: 4, type: 'rest_completed' }] })
      .mockResolvedValueOnce({ events: [{ id: 5, type: 'spell_used' }] })
    const store = useSessionEventsStore()

    await store.setContext({ uuid: 'session-uuid' })
    await store.refresh()

    expect(api.getSessionEvents).toHaveBeenLastCalledWith('session-uuid', { after: 4, limit: 100 })
    expect(store.events.map(event => event.id)).toEqual([4, 5])
  })

  it('attributes modal-sheet rolls to its character and restores the session actor on close', async () => {
    api.getSessionEvents.mockResolvedValue({ events: [] })
    api.createSessionEvent.mockResolvedValue({ event: { id: 1, type: 'dice_roll' } })
    const store = useSessionEventsStore()

    await store.setContext({ uuid: 'session-uuid' })
    store.setActor('char-uuid', 'session-uuid')
    await store.publish({ type: 'dice_roll', action: 'd20' })
    store.setActor(null, 'session-uuid')
    await store.publish({ type: 'dice_roll', action: 'd20' })

    expect(api.createSessionEvent.mock.calls[0][1].actorCharUuid).toBe('char-uuid')
    expect(api.createSessionEvent.mock.calls[1][1].actorCharUuid).toBeNull()
    store.clearContext()
  })

  it('lets a DM roll override the open sheet with a creature actor', async () => {
    api.getSessionEvents.mockResolvedValue({ events: [] })
    api.createSessionEvent.mockResolvedValue({ event: { id: 1, type: 'dice_roll' } })
    const store = useSessionEventsStore()

    await store.setContext({ uuid: 'session-uuid', actorUuid: 'open-sheet' })
    await store.publish({
      type: 'dice_roll',
      action: 'Короткий меч',
      actor: { name: 'Кобольд', charUuid: null },
    })

    expect(api.createSessionEvent.mock.calls[0][1]).toMatchObject({
      action: 'Короткий меч',
      actorCharUuid: null,
      actorName: 'Кобольд',
    })
  })
})
