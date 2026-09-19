// Expiry belongs to an owned stack. Other copies, including another character's,
// keep their own game-time mark; there is no real-time or world-clock scheduler.
export function expireCreatedItem(values, uid) {
  const change = rows => (rows || []).flatMap(entry => {
    const creation = entry.params?.creation
    if (entry.uid !== uid || !creation || creation.duration?.kind === 'permanent') return [entry]
    if (creation.on_expire === 'vanish') return []
    return [{ ...entry, params: { ...entry.params, creation: { ...creation, expired: !creation.expired } } }]
  })
  return {
    ...(values.items ? { items: { ...values.items, equipped: change(values.items.equipped),
      sections: (values.items.sections || []).map(section => ({ ...section, items: change(section.items) })) } } : {}),
    ...(Array.isArray(values.weapon) ? { weapon: change(values.weapon) } : {}),
    ...(Array.isArray(values.potions) ? { potions: change(values.potions) } : {}),
  }
}
