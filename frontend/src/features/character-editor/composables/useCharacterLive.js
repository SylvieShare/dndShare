import { ref, unref, watch } from 'vue'
import { useSessionLive } from '@/features/sessions/composables/useSessionLive'
import { createLiveRoster } from '@/features/sessions/lib/liveRoster'
import { useSessionEventsStore } from '@/stores/sessionEvents'

export function useCharacterLive({ uuid, sessionUuid, sync, onMetadata }) {
  const events = useSessionEventsStore()
  const participants = ref([]),
    receiveRoster = createLiveRoster(participants)
  const live = useSessionLive({
    sessionUuid,
    getChronicleCursor: () => events.latestId(),
    onUpdate(update) {
      if (update.roster) {
        receiveRoster(update.roster)
        const row = participants.value.find(
          (row) => row.charUuid === unref(uuid),
        )
        if (row?.canOpenSheet && row.version > sync.version) {
          sync.receive({
            data: row.data,
            version: row.version,
          })
          onMetadata?.(row)
        }
      }
      if (update.chronicle)
        return events.receiveLive(update.chronicle, unref(sessionUuid))
    },
    onCatchUp: () => sync.catchUp(),
  })
  watch(
    () => unref(sessionUuid),
    (value) => {
      live.stop()
      if (value) live.start()
    },
    { immediate: true },
  )
  return live
}
