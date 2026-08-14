function addedEntries(before, after) {
  if (!Array.isArray(after)) return []
  const remaining = new Map()
  for (const entry of (Array.isArray(before) ? before : [])) {
    const key = String(entry?.id)
    remaining.set(key, (remaining.get(key) || 0) + 1)
  }
  return after.filter((entry) => {
    const key = String(entry?.id)
    const count = remaining.get(key) || 0
    if (!count) return true
    remaining.set(key, count - 1)
    return false
  })
}

export async function levelUpSessionAdditions({
  values,
  updates,
  catalogItems = [],
  spellNames = {},
  loadItems,
}) {
  const additions = [
    ...addedEntries(values?.abilities_class, updates?.abilities_class)
      .map(entry => ({ kind: 'ability', itemId: entry.id })),
    ...addedEntries(values?.abilities_feats, updates?.abilities_feats)
      .map(entry => ({ kind: 'feature', itemId: entry.id })),
    ...addedEntries(values?.spells?.spells, updates?.spells?.spells)
      .map(entry => ({ kind: 'spell', itemId: entry.id })),
  ]
  if (!additions.length) return []
  const names = new Map(catalogItems.filter(Boolean).map(item => [String(item.id), item.name]))
  for (const [id, name] of Object.entries(spellNames)) names.set(String(id), name)
  const missing = [...new Set(additions.map(entry => entry.itemId))]
    .filter(id => id != null && !names.has(String(id)))
  if (missing.length && loadItems) {
    try {
      const response = await loadItems(missing)
      for (const item of response?.items || []) names.set(String(item.id), item.name)
    } catch { /* event titles fall back to the entry kind */ }
  }
  return additions.map(entry => ({
    ...entry,
    title: names.get(String(entry.itemId)) || {
      ability: 'Новая способность', feature: 'Новая черта', spell: 'Новое заклинание',
    }[entry.kind],
  }))
}
