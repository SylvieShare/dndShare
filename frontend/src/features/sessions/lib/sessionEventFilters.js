import { sessionEventActorIdentityKey, sessionEventActorLabel } from './sessionEventView'

export const SESSION_EVENT_CATEGORIES = [
  { value: 'dice', label: 'Броски', icon: '◇', types: ['dice_roll'] },
  { value: 'character', label: 'Персонаж', icon: '✦', types: ['rest_completed', 'spell_used', 'item_spent', 'item_added', 'entry_added', 'resource_used'] },
  { value: 'combat', label: 'Бой', icon: '⚔', types: ['encounter_started', 'encounter_finished'] },
  { value: 'story', label: 'Сюжет', icon: '→', types: ['chapter_started'] },
]

const categoryByType = new Map(SESSION_EVENT_CATEGORIES
  .flatMap(category => category.types.map(type => [type, category.value])))

export function sessionEventCategory(type) {
  return categoryByType.get(type) || 'other'
}

export function sessionEventActorOptions(events) {
  const options = new Map()
  for (const event of events || []) {
    const key = sessionEventActorIdentityKey(event)
    if (options.has(key)) continue
    options.set(key, {
      value: key,
      label: sessionEventActorLabel(event) || 'Системные события',
      system: key === 'system',
    })
  }
  return [...options.values()].sort((left, right) => {
    if (left.system !== right.system) return left.system ? 1 : -1
    return left.label.localeCompare(right.label, 'ru-RU')
  })
}

export function filterSessionEvents(events, {
  author = 'all',
  actor = '',
  categories = [],
} = {}) {
  const selectedCategories = new Set(categories)
  return (events || []).filter(event => {
    if (author === 'owner' && !event.authorIsSessionOwner) return false
    if (author === 'players' && event.authorIsSessionOwner) return false
    if (actor && sessionEventActorIdentityKey(event) !== actor) return false
    if (selectedCategories.size && !selectedCategories.has(sessionEventCategory(event.type))) return false
    return true
  })
}
