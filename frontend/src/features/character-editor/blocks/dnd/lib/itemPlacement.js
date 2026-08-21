import { defaultEntry as defaultWeaponEntry } from './weaponEntry'
import { cloneModel, EQUIPPED_ID, normalizeValue } from './itemSection'

export function cloneOwnedEntry(entry) {
  return {
    uid: entry.uid,
    item_id: entry.item_id ?? null,
    count: Math.max(1, Number(entry.count) || 1),
    params: { ...(entry.params || {}) },
    override: entry.override ? { ...entry.override } : null,
  }
}

export function cloneOwnedCollection(value) {
  return (Array.isArray(value) ? value : []).map(cloneOwnedEntry)
}

export function takeInventoryEntry(value, sectionId, uid) {
  const inventory = cloneModel(normalizeValue(value))
  const list = sectionId === EQUIPPED_ID
    ? inventory.equipped
    : inventory.sections.find(section => section.id === sectionId)?.items
  if (!list) return null
  const index = list.findIndex(entry => entry.uid === uid)
  if (index < 0) return null
  const [entry] = list.splice(index, 1)
  return { inventory, entry: cloneOwnedEntry(entry) }
}

export function appendInventoryEntry(value, entry) {
  const inventory = cloneModel(normalizeValue(value))
  if (!inventory.sections.length) inventory.sections.push({ id: 'bag', name: 'Рюкзак', items: [] })
  inventory.sections[0].items.push(cloneOwnedEntry(entry))
  return inventory
}

export function appendOwnedEntry(value, entry) {
  return [...cloneOwnedCollection(value), cloneOwnedEntry(entry)]
}

export function ownedEntryToWeapons(entry) {
  return Array.from({ length: Math.max(1, Number(entry.count) || 1) }, () => ({
    ...defaultWeaponEntry(),
    item_id: entry.item_id,
    params: { ...defaultWeaponEntry().params, ...(entry.params || {}) },
  }))
}
