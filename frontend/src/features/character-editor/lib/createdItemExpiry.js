// Expiry belongs to an owned stack. Other copies, including another character's,
// keep their own game-time mark; there is no real-time or world-clock scheduler.
export function expireCreatedItem(values, uid) {
  const vanishing = [...(values.weapon || []), ...(values.items?.equipped || []),
    ...(values.items?.sections || []).flatMap(section => section.items || [])]
    .some(entry => entry.uid === uid && entry.params?.creation?.on_expire === 'vanish'
      && entry.params.creation.duration?.kind !== 'permanent')
  const change = rows => (rows || []).flatMap(entry => {
    const creation = entry.params?.creation
    if (entry.uid !== uid || !creation || creation.duration?.kind === 'permanent') return [entry]
    if (creation.on_expire === 'vanish') return []
    return [{ ...entry, params: { ...entry.params, creation: { ...creation, expired: !creation.expired } } }]
  })
  return {
    ...(values.items ? { items: { ...values.items, equipped: change(values.items.equipped),
      sections: (values.items.sections || []).map(section => {
        const next = change(section.items)
        return { ...section, items: next,
          ...(vanishing && section.slots && Object.hasOwn(section.slots, uid)
            ? { slots: Object.fromEntries(Object.entries(section.slots).filter(([key]) => key !== uid)) } : {}),
        }
      }) } } : {}),
    ...(Array.isArray(values.weapon) ? { weapon: change(values.weapon) } : {}),
  }
}
