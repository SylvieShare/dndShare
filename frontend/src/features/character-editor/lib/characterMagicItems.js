import { abilityOwnerLevel } from '@/shared/lib/dndAbilityUses'
import { ABILITY_VALUE_IDS } from '@/shared/lib/abilityTypes'

export const MAGIC_ITEM_TYPE_ID = 19
export const MAGIC_VALUE_ID = 'magic_items'
export const FEATURE_VALUE_IDS = [...ABILITY_VALUE_IDS, MAGIC_VALUE_ID]
const array = value => Array.isArray(value) ? value : []

export function inventoryEntries(values) {
  return [
    ...array(values?.weapon).map(entry => ({ entry, equipped: true })),
    ...array(values?.items?.equipped).map(entry => ({ entry, equipped: true })),
    ...array(values?.items?.sections).flatMap(section => array(section.items).map(entry => ({ entry, equipped: false }))),
  ]
}

export function inventoryItemIds(values) {
  return [...new Set(inventoryEntries(values).flatMap(({ entry }) => [entry.item_id, entry.magic_item_id]).filter(id => id != null))]
}

export function magicItemActive(item, entry, equipped, values) {
  if (!entry || Number(item?.typeId) !== MAGIC_ITEM_TYPE_ID || Number(entry?.count ?? 1) <= 0) return false
  if (values && abilityOwnerLevel(item.data || {}, values) < Math.max(1, Number(item.data?.level) || 1)) return false
  if (item.data?.activation !== 'carried' && !equipped) return false
  if (item.data?.attunement !== 'none' && !entry.params?.magic?.attuned) return false
  return true
}

// Adapt inventory instances to the shared mechanics contract. Quantity is never a charge counter.
export function featureEntries(values, valueId, itemsById = new Map(), includeInactive = false) {
  if (valueId !== MAGIC_VALUE_ID) return array(values?.[valueId])
  return inventoryEntries(values).flatMap(({ entry, equipped }) => {
    const sourceId = entry.magic_item_id ?? entry.item_id
    const item = itemsById.get(String(sourceId))
    if (Number(item?.typeId) !== MAGIC_ITEM_TYPE_ID || !entry.uid) return []
    if (!includeInactive && !magicItemActive(item, entry, equipped, values)) return []
    const state = entry.params?.magic || {}
    return [{ ...state, id: sourceId, uid: entry.uid, count: state.remaining }]
  })
}

export function patchFeatureEntries(values, valueId, entries) {
  if (valueId !== MAGIC_VALUE_ID) return { [valueId]: entries }
  const byUid = new Map(entries.map(entry => [entry.uid, entry]))
  return mapOwnedEntries(values, entry => {
    const next = byUid.get(entry.uid)
    if (!next) return entry
    const { id, uid, count, ...state } = next
    return { ...entry, params: { ...entry.params, magic: { ...state, remaining: count } } }
  })
}

export function mapOwnedEntries(values, transform) {
  return { ...(values.items ? { items: mapInventoryEntries(values.items, transform) } : {}),
    ...(Array.isArray(values.weapon) ? { weapon: values.weapon.map(transform) } : {}) }
}

export function mapInventoryEntries(items, transform) {
  return {
    ...items,
    equipped: array(items?.equipped).map(transform),
    sections: array(items?.sections).map(section => ({ ...section, items: array(section.items).map(transform) })),
  }
}

export function updateMagicItemState(items, uid, patch) {
  return mapInventoryEntries(items, entry => entry.uid === uid
    ? { ...entry, params: { ...entry.params, magic: { ...entry.params?.magic, ...patch } } }
    : entry)
}

export function featureItemIds(values) {
  return [...new Set([...ABILITY_VALUE_IDS.flatMap(key => array(values?.[key]).map(entry => entry.id)), ...inventoryItemIds(values)].filter(id => id != null))]
}
