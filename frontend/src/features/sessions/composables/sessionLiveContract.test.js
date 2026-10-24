import { readFileSync } from 'node:fs'
import { afterEach, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ref } from 'vue'
import { useSessionLive } from './useSessionLive'
import { createLiveRoster } from '../lib/liveRoster'
import { useSessionEventsStore } from '@/stores/sessionEvents'
import { useAccountStore } from '@/stores/account'
import { useNotificationsStore } from '@/stores/notifications'

vi.mock('vue', async original => ({ ...(await original()), onBeforeUnmount: vi.fn() }))
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })

it('applies the Go SSE baseline and chronicle delta without refetching or duplicate notifications', async () => {
  vi.useFakeTimers()
  setActivePinia(createPinia())
  const contract = JSON.parse(readFileSync(new URL('../../../../../internal/web/testdata/session-live.json', import.meta.url), 'utf8'))
  let source
  vi.stubGlobal('EventSource', class {
    constructor() { source = this }
    addEventListener(type, callback) { this[type] = callback }
    close() {}
  })
  useAccountStore().user = { id: 1 }
  const events = useSessionEventsStore(), notifications = useNotificationsStore()
  events.sessionUuid = 'contract'
  const participants = ref([]), receiveRoster = createLiveRoster(participants)
  const catchUp = vi.fn()
  const onUpdate = vi.fn(async update => {
    if (update.roster) receiveRoster(update.roster)
    if (update.chronicle) await events.receiveLive(update.chronicle, 'contract')
  })
  const live = useSessionLive({ sessionUuid: 'contract', onCatchUp: catchUp, onUpdate })
  live.start()
  try {
    source.onopen()
    source.update({ data: JSON.stringify(contract.initial) })
    await vi.waitFor(() => expect(events.events).toHaveLength(1))
    expect(participants.value[0].data.values.hp.current).toBe(10)
    expect(notifications.entries).toHaveLength(0)
    source.update({ data: JSON.stringify(contract.delta) })
    await vi.waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(2))
    expect(events.events).toHaveLength(2)
    expect(events.latestId()).toBe(2)
    expect(notifications.entries).toHaveLength(1)
    source.update({ data: JSON.stringify(contract.delta) })
    await vi.waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(3))
    expect(events.events).toHaveLength(2)
    expect(notifications.entries).toHaveLength(1)
    expect(catchUp).not.toHaveBeenCalled()
  } finally { live.stop(); notifications.clear(); events.$dispose() }
})
