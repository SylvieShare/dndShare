import { cloneModel, normalizeValue } from '../blocks/dnd/lib/itemSection'

/** Weapon membership belongs to a single owned instance; the inventory stays canonical. */
export function setInventoryWeaponEnabled(items, uid, enabled, params = {}) {
  const next = cloneModel(normalizeValue(items))
  const lists = [next.equipped, ...next.sections.map(section => section.items)]
  const source = lists.find(list => list.some(row => row.uid === uid))
  if (!source) return items
  const index = source.findIndex(row => row.uid === uid)
  const entry = source[index]
  entry.params = { ...entry.params, ...params, weapon_enabled: enabled }
  if (enabled && source !== next.equipped) {
    source.splice(index, 1)
    next.equipped.push(entry)
  }
  return next
}

export function clearStowedWeaponFlags(items) {
  return { ...items, sections: (items?.sections || []).map(section => ({ ...section,
    items: (section.items || []).map(entry => entry.params?.weapon_enabled
      ? { ...entry, params: { ...entry.params, weapon_enabled: false } } : entry),
  })) }
}
