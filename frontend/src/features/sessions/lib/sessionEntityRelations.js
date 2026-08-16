export const SESSION_ENTITY_TYPES = [
  { key: 'location', label: 'Локации', singular: 'Локация', color: '#4ea58b' },
  { key: 'npc', label: 'NPC', singular: 'NPC', color: '#9b78e8' },
  { key: 'material', label: 'Материалы', singular: 'Материал', color: '#d7a84e' },
  { key: 'quest', label: 'Задания', singular: 'Задание', color: '#4b8fd5' },
]

export function sessionEntityType(type) {
  return SESSION_ENTITY_TYPES.find(item => item.key === type) || SESSION_ENTITY_TYPES[0]
}

export function sessionEntityKey(type, id) { return `${type}:${Number(id)}` }

export function buildSessionEntityCatalog(world, materials) {
  const entries = [
    ...(world?.locations?.value || []).map(item => ({ type: 'location', id: item.id, title: item.name, subtitle: item.kind, image: item.imageUrl })),
    ...(world?.npcs?.value || []).map(item => ({ type: 'npc', id: item.id, title: item.name, subtitle: [item.raceName, item.role].filter(Boolean).join(' · '), image: item.imageUrl, color: item.color })),
    ...(materials?.materials?.value || []).map(item => ({ type: 'material', id: item.id, title: item.name, subtitle: item.kind, image: ['image', 'map'].includes(item.kind) ? item.assetUrl : '' })),
    ...(world?.quests?.value || []).map(item => ({ type: 'quest', id: item.id, title: item.name, subtitle: questStatus(item.status).label, color: questStatus(item.status).color })),
  ]
  return entries.map(item => ({ ...item, key: sessionEntityKey(item.type, item.id), typeMeta: sessionEntityType(item.type) }))
}

export function groupResolvedRelations(relations, catalog) {
  const byKey = new Map(catalog.map(item => [item.key, item]))
  return SESSION_ENTITY_TYPES.map(type => ({
    ...type,
    items: (relations || [])
      .filter(relation => relation.type === type.key)
      .map(relation => ({ relation, item: byKey.get(sessionEntityKey(relation.type, relation.id)) }))
      .filter(entry => entry.item)
      .sort((a, b) => a.item.title.localeCompare(b.item.title, 'ru')),
  })).filter(group => group.items.length)
}

export const QUEST_STATUSES = [
  { key: 'planned', label: 'Запланировано', color: '#8490a2' },
  { key: 'active', label: 'В процессе', color: '#4b8fd5' },
  { key: 'completed', label: 'Выполнено', color: '#4ea58b' },
  { key: 'failed', label: 'Провалено', color: '#d26969' },
]

export function questStatus(status) {
  return QUEST_STATUSES.find(item => item.key === status) || QUEST_STATUSES[0]
}
