export const LOCATION_KINDS = [
  { key: 'region', label: 'Регион', shortLabel: 'Регион', icon: 'compass', preset: 'mountains', color: '#7c5cff' },
  { key: 'settlement', label: 'Город или поселение', shortLabel: 'Поселение', icon: 'landmark', preset: 'city', color: '#e89c3c' },
  { key: 'district', label: 'Район', shortLabel: 'Район', icon: 'blocks', preset: 'road', color: '#5cb0e8' },
  { key: 'building', label: 'Здание', shortLabel: 'Здание', icon: 'house', preset: 'tavern', color: '#e8763c' },
  { key: 'room', label: 'Комната или зал', shortLabel: 'Комната', icon: 'door', preset: 'discovery', color: '#a06ce8' },
  { key: 'wilderness', label: 'Природная местность', shortLabel: 'Местность', icon: 'trees', preset: 'forest', color: '#5ce87c' },
  { key: 'dungeon', label: 'Подземелье или пещера', shortLabel: 'Подземелье', icon: 'route', preset: 'dungeon', color: '#e85c5c' },
  { key: 'other', label: 'Другое место', shortLabel: 'Место', icon: 'map-pin', preset: 'discovery', color: '#8888aa' },
]

export const LOCATION_KIND_MAP = new Map(LOCATION_KINDS.map(kind => [kind.key, kind]))

export function locationKind(kind) {
  return LOCATION_KIND_MAP.get(kind) || LOCATION_KIND_MAP.get('other')
}

export function buildLocationForest(locations) {
  const byId = new Map(locations.map(location => [location.id, { ...location, children: [] }]))
  const roots = []
  for (const node of byId.values()) {
    const parent = node.parentLocationId ? byId.get(node.parentLocationId) : null
    if (parent && parent.id !== node.id) parent.children.push(node)
    else roots.push(node)
  }
  const sortNodes = nodes => {
    nodes.sort((left, right) => left.sortOrder - right.sortOrder || left.id - right.id)
    nodes.forEach(node => sortNodes(node.children))
  }
  sortNodes(roots)
  return roots
}

export function locationBreadcrumb(location, locationsById) {
  const result = []
  const visited = new Set()
  let current = location
  while (current && !visited.has(current.id)) {
    visited.add(current.id)
    result.unshift(current)
    current = current.parentLocationId ? locationsById.get(current.parentLocationId) : null
  }
  return result
}

export function locationDescendantIds(locationId, locations) {
  const result = new Set()
  let changed = true
  while (changed) {
    changed = false
    for (const location of locations) {
      if (result.has(location.id)) continue
      if (location.parentLocationId === locationId || result.has(location.parentLocationId)) {
        result.add(location.id)
        changed = true
      }
    }
  }
  return result
}

export function locationSearchMatches(location, query) {
  if (!query) return true
  const haystack = `${location.name} ${location.description || ''} ${locationKind(location.kind).label}`.toLocaleLowerCase('ru')
  return haystack.includes(query.toLocaleLowerCase('ru'))
}

export function sceneContextLabel(scene) {
  return `${scene.arcName} · Глава ${scene.chapterNumber} · ${scene.chapterName}`
}

export function npcInitial(name) {
  return String(name || '?').trim().charAt(0).toLocaleUpperCase('ru') || '?'
}

export function ruPlural(count, one, few, many) {
  const absolute = Math.abs(Number(count)) % 100
  const last = absolute % 10
  if (absolute > 10 && absolute < 20) return many
  if (last === 1) return one
  if (last >= 2 && last <= 4) return few
  return many
}
