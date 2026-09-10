export function isSourceSelected(ids, id, useAll = false) {
  return useAll || ids.some(value => String(value) === String(id))
}

export function toggleSourceSelection(sources, ids, id, useAll = false) {
  const current = useAll ? sources.map(source => source.id) : ids
  return isSourceSelected(current, id)
    ? current.filter(value => String(value) !== String(id))
    : [...current, id]
}

export function selectAllSources(sources, checked) {
  return checked ? sources.map(source => source.id) : []
}
