export const RACE_ITEM_TYPE = 8
export const CLASS_ITEM_TYPE = 9
export const SUBRACE_ITEM_TYPE = 16
export const SUBCLASS_ITEM_TYPE = 17

export function itemReferenceId(value) {
  const raw = value && typeof value === 'object' ? value.id : value
  if (raw == null || raw === '') return null
  const id = Number(raw)
  return Number.isInteger(id) && id > 0 ? id : null
}

export function itemReferenceIds(values) {
  return (Array.isArray(values) ? values : [])
    .map(itemReferenceId)
    .filter(id => id != null)
}

export function originChildren(parent, candidates, relationKey) {
  const ids = new Set(itemReferenceIds(parent?.data?.[relationKey]).map(String))
  const parentId = itemReferenceId(parent)
  const parentKey = relationKey === 'subraces' ? 'race' : relationKey === 'subclasses' ? 'class' : ''
  return (candidates || []).filter(item => ids.has(String(item.id))
    || (parentId != null && parentKey && itemReferenceId(item?.data?.[parentKey]) === parentId))
}

export function originFilterQuery(relationKey, parentId) {
  const id = itemReferenceId(parentId)
  if (id == null) return ''
  return `&filters=${encodeURIComponent(JSON.stringify({ [relationKey]: [id] }))}`
}
