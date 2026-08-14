const ENTRY_KINDS = new Set(['item', 'potion', 'spell', 'feature', 'ability'])

export function logSessionEntryAdded(charCtx, {
  kind,
  title,
  itemId = null,
  count = 1,
  category = null,
  level = null,
} = {}) {
  const normalizedTitle = String(title || '').trim()
  if (!ENTRY_KINDS.has(kind) || !normalizedTitle) return
  charCtx?.logSessionEvent?.({
    type: 'entry_added',
    title: normalizedTitle,
    data: {
      kind,
      itemId,
      count: Math.max(1, Number(count) || 1),
      ...(category ? { category } : {}),
      ...(level != null ? { level: Number(level) || 0 } : {}),
    },
  })
}
