/** Separate conditional effects: their dice must never be summed as one hit. */
export function spellRollOptions(entry) {
  const data = entry.item?.data || {}
  const base = ['damage', 'heal'].filter(kind => data[kind]?.dices?.length)
    .map(kind => ({ key: kind, kind, label: kind === 'damage' ? 'Урон' : 'Лечение', rule: data[kind], entry, primary: true }))
  const effects = (data.rolls || []).map((rule, index) => {
    const kind = rule.kind || 'effect'
    const field = kind === 'heal' ? 'heal' : 'damage'
    return { key: `effect:${index}`, kind, label: rule.label || 'Эффект', rule, primary: false,
      entry: { ...entry, item: { ...entry.item, name: `${entry.item.name} — ${rule.label || 'Эффект'}`,
        data: { ...data, damage: undefined, heal: undefined, [field]: rule } } },
    }
  })
  return [...base, ...effects]
}
