export function createHeaderChip(label, color = '') {
  if (label == null || String(label).trim() === '') return null
  return {
    label: String(label),
    color: typeof color === 'string' ? color : '',
  }
}

export function normalizeHeaderChip(chip) {
  if (chip == null) return null
  if (typeof chip !== 'object') return createHeaderChip(chip)
  return createHeaderChip(chip.label, chip.color)
}

export function resolveAppHeaderContext({
  routeTitle,
  routeName,
  title,
  chip,
  owner,
  allowUnscoped = false,
} = {}) {
  const scopedToRoute = owner != null && String(owner) === String(routeName)
  const ownsCurrentRoute = scopedToRoute || (owner == null && allowUnscoped)
  const customTitle = ownsCurrentRoute && typeof title === 'string' ? title.trim() : ''

  return {
    title: customTitle || (typeof routeTitle === 'string' && routeTitle.trim()) || 'DnD Share',
    chip: ownsCurrentRoute ? normalizeHeaderChip(chip) : null,
  }
}
