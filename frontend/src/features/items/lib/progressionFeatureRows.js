/** One handbook row per ability, even if several rules improve at once. */
export function progressionFeatureRows(features = [], improvements = []) {
  const byId = new Map(features.map(item => [item.id, { item, upgraded: false, changes: [] }]))
  for (const { item, text } of improvements) {
    if (!byId.has(item.id)) byId.set(item.id, { item, upgraded: true, changes: [] })
    const row = byId.get(item.id)
    if (text && !row.changes.includes(text)) row.changes.push(text)
  }
  return [...byId.values()]
}
