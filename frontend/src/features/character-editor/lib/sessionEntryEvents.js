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
  const prefix = {
    potion: 'Добавлено зелье',
    spell: 'Добавлено заклинание',
    feature: 'Добавлена черта',
    ability: 'Добавлена способность',
  }[kind] || (category === 'weapon' ? 'Добавлено оружие' : 'Добавлен предмет')
  charCtx?.logSessionEvent?.({
    type: 'entry_added',
    action: `${prefix}: ${normalizedTitle}`,
    data: {
      kind,
      itemId,
      count: Math.max(1, Number(count) || 1),
      ...(category ? { category } : {}),
      ...(level != null ? { level: Number(level) || 0 } : {}),
    },
  })
}
