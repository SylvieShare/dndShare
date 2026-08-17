export function groupHeaderSearchResults(results = []) {
  const groups = new Map()

  for (const result of results) {
    const kind = ['suggest', 'rule'].includes(result.kind) ? result.kind : 'item'
    const typeId = result.typeId ?? 'unknown'
    const key = `${kind}:${typeId}`

    if (!groups.has(key)) {
      groups.set(key, {
        key,
        kind,
        label: result.typeLabel || (kind === 'suggest' ? 'Подсказки' : kind === 'rule' ? 'Правила' : 'Предметы'),
        results: [],
      })
    }

    groups.get(key).results.push(result)
  }

  let displayIndex = 0
  return [...groups.values()].map(group => ({
    ...group,
    results: group.results.map(result => ({
      ...result,
      displayIndex: displayIndex++,
    })),
  }))
}
