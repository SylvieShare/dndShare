export function defaultEntry() {
  return { item_id: null, magic_up: 0, stat_suggest_id: null, proficient: false, add_attacks: [], desc: '' }
}

export function normalizeAddAttacks(attacks) {
  return (attacks || []).map(attack => ({
    count: Number(attack.count) || 1,
    dice_suggest_id: attack.dice_suggest_id ?? null,
    type_suggest_id: attack.type_suggest_id ?? null,
  }))
}

export function cleanEntry(entry) {
  return {
    item_id: entry.item_id,
    magic_up: Number(entry.magic_up) || 0,
    stat_suggest_id: entry.stat_suggest_id ?? null,
    proficient: !!entry.proficient,
    add_attacks: normalizeAddAttacks(entry.add_attacks),
    desc: entry.desc || '',
  }
}

export function isSameCleanValue(nextValue, currentEntries) {
  return JSON.stringify(nextValue || []) === JSON.stringify(currentEntries.map(cleanEntry))
}

export function findFieldByKey(fields, key) {
  for (const field of fields || []) {
    if (field.key === key) return field
    const nested = findFieldByKey(field.fields || [], key)
    if (nested) return nested
  }
  return null
}
