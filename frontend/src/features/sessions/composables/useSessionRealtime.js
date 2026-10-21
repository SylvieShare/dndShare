import { getSession } from '@/shared/api/sessionsApi'
import { useParticipantSync } from './useParticipantSync'
import { useSessionLive } from './useSessionLive'
import { createLiveRoster } from '../lib/liveRoster'

export function useSessionRealtime({
  sessionUuid,
  session,
  participants,
  currentChapter,
  sessionRole,
  myCharUuid,
  isDm,
  coloringIds,
  participantOrderSaving,
  presentation,
  sessionEventsStore,
}) {
  async function refreshParticipants() {
    const fresh = await getSession(sessionUuid)
    if (!Array.isArray(fresh?.participants)) return
    session.value = fresh.session ?? session.value
    if (!isDm.value) {
      currentChapter.value = fresh.currentChapter ?? null
      sessionRole.value = fresh.myRole || 'player'
      myCharUuid.value = fresh.myCharUuid || myCharUuid.value
    }
    const localById = new Map(
      participants.value.map((participant) => [
        String(participant.charId),
        participant,
      ]),
    )
    const serverById = new Map(
      fresh.participants.map((participant) => [
        String(participant.charId),
        participant,
      ]),
    )
    const withPendingColor = (participant) =>
      coloringIds.value.has(participant.charId)
        ? {
            ...participant,
            color: localById.get(String(participant.charId))?.color ?? null,
          }
        : participant
    participants.value = participantOrderSaving.value
      ? [
          ...participants.value
            .map((participant) => serverById.get(String(participant.charId)))
            .filter(Boolean),
          ...fresh.participants.filter(
            (participant) => !localById.has(String(participant.charId)),
          ),
        ].map(withPendingColor)
      : fresh.participants.map(withPendingColor)
  }

  const { syncStatus, syncRunning, requestParticipants } = useParticipantSync({
    participants,
    refreshParticipants,
  })

  const receiveRoster = createLiveRoster(participants, {
    pendingColors: () => coloringIds.value,
    pendingOrder: () => participantOrderSaving.value,
  })

  const {
    status: liveStatus,
    catchingUp: liveCatchingUp,
    start: startSessionLive,
  } = useSessionLive({
    sessionUuid,
    getChronicleCursor: () => sessionEventsStore.latestId(),
    onUpdate(update) {
      const tasks = []
      if (update?.roster) {
        receiveRoster(update.roster)
      }
      if (update?.chronicle)
        tasks.push(
          sessionEventsStore.receiveLive(update.chronicle, sessionUuid),
        )
      if (update?.session) tasks.push(refreshParticipants())
      if (update?.connectedScreens != null && isDm.value) {
        presentation.setConnectedScreens(update.connectedScreens)
      }
      return Promise.all(tasks)
    },
    onCatchUp() {
      const tasks = [requestParticipants(), sessionEventsStore.refresh()]
      if (isDm.value) {
        tasks.push(presentation.loadConnections())
      }
      return Promise.all(tasks)
    },
  })

  return {
    syncStatus,
    syncRunning,
    refreshParticipants,
    liveStatus,
    liveCatchingUp,
    startSessionLive,
  }
}
