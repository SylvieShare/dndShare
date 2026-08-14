import { pvName } from '@/features/sessions/lib/participantView'

export function sessionEventCharacterName(event, resolveName = pvName) {
  if (!event?.actorTemplateId || !event?.actorData) return ''
  return resolveName({ templateId: event.actorTemplateId, data: event.actorData }) || ''
}

export function sessionEventAuthorLabel(event) {
  const role = event?.authorRole === 'gm' ? 'Мастер' : 'Игрок'
  return event?.authorLogin ? `${role}: ${event.authorLogin}` : role
}
