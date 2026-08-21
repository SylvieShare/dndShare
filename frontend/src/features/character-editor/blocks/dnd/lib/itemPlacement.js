import {
  defaultEntry as defaultWeaponEntry,
  normalizeAddAttacks,
  normalizeWeaponParams,
} from './weaponEntry'
import { cloneModel, EQUIPPED_ID, makeEntryUid, normalizeValue } from './itemSection'

const WEAPON_STATE_KEY = '_weapon_state'

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

export function weaponEntryToOwnedEntry(entry) {
  return {
    uid: makeEntryUid(),
    item_id: entry.item_id ?? null,
    count: 1,
    params: {
      ...(entry.params || {}),
      [WEAPON_STATE_KEY]: {
        stat_suggest_id: entry.stat_suggest_id ?? null,
        proficient: !!entry.proficient,
        add_attacks: normalizeAddAttacks(entry.add_attacks),
        desc: entry.desc || '',
      },
    },
    override: null,
  }
}

export function ownedEntryToWeapons(entry) {
  const params = { ...(entry.params || {}) }
  const savedState = params[WEAPON_STATE_KEY] && typeof params[WEAPON_STATE_KEY] === 'object'
    ? params[WEAPON_STATE_KEY]
    : {}
  delete params[WEAPON_STATE_KEY]
  return Array.from({ length: Math.max(1, Number(entry.count) || 1) }, () => ({
    ...defaultWeaponEntry(),
    ...savedState,
    item_id: entry.item_id,
    params: normalizeWeaponParams({ ...defaultWeaponEntry().params, ...params }),
    add_attacks: normalizeAddAttacks(savedState.add_attacks),
  }))
}
