export const CONTENT_SOURCE_KINDS = [
  { kind: 'core', label: 'Основные книги' },
  { kind: 'supplement', label: 'Официальные дополнения' },
  { kind: 'setting', label: 'Сеттинги' },
  { kind: 'adventure', label: 'Приключения' },
  { kind: 'playtest', label: 'Unearthed Arcana' },
  { kind: 'third_party', label: 'Сторонние материалы' },
]

const coreOrder = new Map(['PHB', 'MM', 'DMG'].map((code, index) => [code, index]))

function sourceOrder(left, right) {
  if (left.kind === 'core' && right.kind === 'core') {
    const leftOrder = coreOrder.get(String(left.code || '').toUpperCase()) ?? Number.MAX_SAFE_INTEGER
    const rightOrder = coreOrder.get(String(right.code || '').toUpperCase()) ?? Number.MAX_SAFE_INTEGER
    if (leftOrder !== rightOrder) return leftOrder - rightOrder
  }
  return String(left.name || left.code || '').localeCompare(String(right.name || right.code || ''), 'ru')
}

export function groupContentSources(sources) {
  return CONTENT_SOURCE_KINDS.map(definition => ({
    ...definition,
    sources: (sources || []).filter(source => source.kind === definition.kind).sort(sourceOrder),
  })).filter(group => group.sources.length > 0)
}
