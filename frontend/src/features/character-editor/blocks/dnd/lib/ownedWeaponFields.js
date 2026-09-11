export function ownedWeaponFields(entry) {
  return Object.fromEntries(['magic_item_id', 'stat_suggest_id', 'proficient', 'add_attacks', 'desc']
    .filter(key => entry[key] !== undefined).map(key => [key, key === 'add_attacks' ? (entry[key] || []).map(row => ({ ...row })) : entry[key]]))
}
