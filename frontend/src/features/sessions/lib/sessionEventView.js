import { pvName } from '@/features/sessions/lib/participantView'

export function sessionEventActorLabel(event, resolveName = pvName) {
  const isDm = event?.authorRole === 'gm'
  const characterName = event?.actorTemplateId && event?.actorData
    ? resolveName({ templateId: event.actorTemplateId, data: event.actorData }) || ''
    : ''
  if (characterName) return isDm ? `${characterName} (мастер)` : characterName
  return isDm ? 'Мастер' : 'Игрок'
}

export function sessionEventActorKey(event) {
  const role = event?.authorRole === 'gm' ? 'gm' : 'player'
  const character = event?.actorCharUuid || event?.actorCharId
  if (character) return `${role}:character:${character}`
  return role === 'gm' ? 'gm:session' : `player:${event?.authorUserId || 'unknown'}`
}

export function groupSessionEvents(events, resolveName = pvName) {
  const sorted = [...(events || [])].sort((left, right) => {
    const timeDiff = new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
    return timeDiff || Number(right.id || 0) - Number(left.id || 0)
  })
  const groups = []
  for (const event of sorted) {
    const date = new Date(event.createdAt)
    const valid = !Number.isNaN(date.getTime())
    const minuteKey = valid ? String(Math.floor(date.getTime() / 60000)) : `unknown:${event.id}`
    let timeGroup = groups.at(-1)
    if (!timeGroup || timeGroup.key !== minuteKey) {
      timeGroup = {
        key: minuteKey,
        time: valid ? date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : '',
        actors: [],
      }
      groups.push(timeGroup)
    }
    const actorKey = sessionEventActorKey(event)
    let actorGroup = timeGroup.actors.at(-1)
    if (!actorGroup || actorGroup.actorKey !== actorKey) {
      actorGroup = {
        key: `${actorKey}:${event.id}`,
        actorKey,
        label: sessionEventActorLabel(event, resolveName),
        events: [],
      }
      timeGroup.actors.push(actorGroup)
    }
    actorGroup.events.push(event)
  }
  return groups
}
