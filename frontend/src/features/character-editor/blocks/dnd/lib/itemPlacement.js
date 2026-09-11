import {
  defaultEntry as defaultWeaponEntry,
  normalizeAddAttacks,
  normalizeWeaponParams,
} from './weaponEntry'
import { cloneModel, EQUIPPED_ID, makeEntryUid, normalizeValue } from './itemSection'

import { ownedWeaponFields } from './ownedWeaponFields'

export function cloneOwnedEntry(entry) {
  return {
    ...ownedWeaponFields(entry),
    uid: entry.uid || makeEntryUid(),
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

export function weaponEntryToOwnedEntry(entry) {
  return cloneOwnedEntry({ ...entry, count: 1 })
}

export function ownedEntryToWeapons(entry) {
  return Array.from({ length: Math.max(1, Number(entry.count) || 1) }, (_, index) => ({
    ...defaultWeaponEntry(), ...ownedWeaponFields(entry),
    uid: index === 0 && entry.uid ? entry.uid : makeEntryUid(),
    item_id: entry.item_id,
    override: entry.override ? { ...entry.override } : null,
    params: normalizeWeaponParams(entry.params),
    add_attacks: normalizeAddAttacks(entry.add_attacks),
  }))
}
