export function sessionEventActorLabel(event) {
  return String(event?.actorName || '').trim()
}

export function sessionEventActorIdentityKey(event) {
  const character = event?.actorCharUuid || event?.actorCharId
  if (character) return `character:${character}`
  const actorName = sessionEventActorLabel(event)
  return actorName ? `name:${actorName.toLocaleLowerCase('ru-RU')}` : 'system'
}

export function sessionEventActorKey(event) {
  const author = event?.authorIsSessionOwner ? 'owner' : 'player'
  return `${author}:${sessionEventActorIdentityKey(event)}`
}

export function groupSessionEvents(events) {
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
        label: sessionEventActorLabel(event),
        authorIsSessionOwner: !!event.authorIsSessionOwner,
        events: [],
      }
      timeGroup.actors.push(actorGroup)
    }
    actorGroup.events.push(event)
  }
  return groups
}
