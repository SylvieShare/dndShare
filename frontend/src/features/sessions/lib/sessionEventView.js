import { pvName } from '@/features/sessions/lib/participantView'

export function sessionEventActorLabel(event, resolveName = pvName) {
  const isDm = event?.authorRole === 'gm'
  const characterName = event?.actorTemplateId && event?.actorData
    ? resolveName({ templateId: event.actorTemplateId, data: event.actorData }) || ''
    : ''
  if (characterName) return isDm ? `${characterName} (мастер)` : characterName
  return isDm ? 'Мастер' : 'Игрок'
}
