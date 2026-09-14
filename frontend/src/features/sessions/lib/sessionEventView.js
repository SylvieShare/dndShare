import { sessionEventEntity } from './sessionEventEntity'

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
  const author = event?.authorUserId ?? event?.authorName ?? (event?.authorIsSessionOwner ? 'owner' : 'player')
  return JSON.stringify([author, sessionEventActorIdentityKey(event), sessionEventActorLabel(event)])
}

export function sessionEventActorKind(event) {
  if (event?.actorCharUuid || event?.actorCharId) return 'character'
  if (event?.actorItemId || sessionEventActorLabel(event)) return 'creature'
  if (event?.authorIsSessionOwner) return 'dm'
  return 'system'
}

export function groupSessionEvents(events) {
  const sorted = [...(events || [])].sort((left, right) => {
    const timeDiff = new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
    return timeDiff || Number(right.id || 0) - Number(left.id || 0)
  })
  const groups = []
  for (const event of sorted) {
    const actorKey = sessionEventActorKey(event)
    let actorGroup = groups.at(-1)
    if (!actorGroup || actorGroup.actorKey !== actorKey) {
      actorGroup = {
        key: `${actorKey}:${event.id}`,
        actorKey,
        label: sessionEventActorLabel(event),
        kind: sessionEventActorKind(event),
        actorEvent: event,
        authorIsSessionOwner: !!event.authorIsSessionOwner,
        events: [],
        entities: [],
        authorName: event.authorName || '',
      }
      groups.push(actorGroup)
    }
    actorGroup.events.push(event)
    const entity = sessionEventEntity(event)
    const entityKey = entity?.key || `event:${event.id}`
    let entityGroup = actorGroup.entities.at(-1)
    if (!entityGroup || entityGroup.entityKey !== entityKey) {
      entityGroup = { key: `${entityKey}:${event.id}`, entityKey, entity, events: [] }
      actorGroup.entities.push(entityGroup)
    }
    entityGroup.events.push(event)
  }
  // Anchor groups to their oldest event so prepending does not remount old rows.
  for (const group of groups) {
    group.key = `${group.actorKey}:${group.events.at(-1).id}`
    for (const entry of group.entities) entry.key = `${entry.entityKey}:${entry.events.at(-1).id}`
  }
  return groups
}
