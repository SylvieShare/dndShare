import { watch } from 'vue'
import { useNotificationsStore } from '@/stores/notifications'
import { localState } from './offline'
import { localSyncProblems } from './localSyncProblems'

export function useLocalSyncFeedback() {
  const notifications = useNotificationsStore()
  let lastEvent = null
  watch(() => [localState.accountId, localSyncProblems.event], ([accountId, event]) => {
    if (!accountId) { notifications.clear('local-sync'); lastEvent = null; return }
    if (!event || event.accountId !== accountId || event.id === lastEvent) return
    lastEvent = event.id
    notifications.notify({ type: 'sync-error', title: event.title, data: { message: event.message },
      key: `local-sync:${event.group}`, scope: 'local-sync', duration: 10000 })
  }, { immediate: true, flush: 'sync' })
}
