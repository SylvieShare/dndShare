import { inventoryEntries, mapOwnedEntries } from './characterMagicItems'

export function itemUseDawnCandidates(values, items) {
  return inventoryEntries(values).flatMap(({ entry }) => {
    const item = items.get(String(entry.magic_item_id ?? entry.item_id))
    if (!item || entry.params?.magic?.lost) return []
    return (item.data?.confirmed_uses || []).flatMap(rule => {
      const remaining = Math.max(0, Number(entry.params?.magic?.use_cooldowns?.[rule.key]) || 0)
      return remaining > 0 ? [{ uid: entry.uid, key: rule.key, title: `${item.name}: ${rule.title}`, before: remaining, after: remaining - 1 }] : []
    })
  })
}
export function advanceItemUseCooldowns(values, items) {
  const results = itemUseDawnCandidates(values, items)
  if (!results.length) return { patch: {}, results }
  const patch = mapOwnedEntries(values, entry => {
    const changed = results.filter(row => row.uid === entry.uid)
    if (!changed.length) return entry
    const cooldowns = { ...entry.params?.magic?.use_cooldowns }
    for (const row of changed) { if (row.after) cooldowns[row.key] = row.after; else delete cooldowns[row.key] }
    return { ...entry, params: { ...entry.params, magic: { ...entry.params?.magic, use_cooldowns: cooldowns } } }
  })
  return { patch, results }
}
