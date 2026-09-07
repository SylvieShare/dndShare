// A collection of references is a multiselect; records with additional rules
// (levels, counts, spell grants, etc.) still need the structured array editor.
export function itemSelectionField(field) {
  if (field?.type !== 'object_array' || field.fields?.length !== 1) return null
  const reference = field.fields[0]
  return reference.key === 'id' && reference.type === 'item' && reference.item_type != null ? reference : null
}

export function uniqueItemIds(ids) {
  return [...new Set((ids || []).map(Number).filter(id => Number.isInteger(id) && id > 0))]
}

export function itemSelectionRows(rows, ids) {
  return uniqueItemIds(ids).map(id => ({ ...(rows || []).find(row => Number(row?.id) === id), id }))
}

export function toggleItemId(ids, id) {
  const current = uniqueItemIds(ids)
  return current.includes(Number(id)) ? current.filter(value => value !== Number(id)) : uniqueItemIds([...current, id])
}
