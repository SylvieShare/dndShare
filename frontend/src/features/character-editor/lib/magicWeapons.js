import { magicBaseId } from '@/features/items/lib/magicEquipmentBases'
import { magicItemActive, mapInventoryEntries } from './characterMagicItems'

const PHYSICAL_KEYS = ['attacks', 'universe_attacks', 'tags', 'is_military', 'is_long_range', 'range_min', 'range_max', 'required_weapon_proficiencies']
export const weaponBaseId = (item, entry) => magicBaseId(item, entry?.params, 'weapon')

export function resolveMagicWeapon(item, entry, itemsById) {
  const base = itemsById[String(weaponBaseId(item, entry))]
  if (Number(base?.typeId) !== 1) return null
  const physical = Object.fromEntries(PHYSICAL_KEYS.map(key => [key, base.data?.[key]]))
  const rule = item.data.weapon
  if (rule.damage_type != null) for (const key of ['attacks', 'universe_attacks']) physical[key] = (physical[key] || []).map(a => ({ ...a, type: rule.damage_type }))
  physical.tags = [...new Set([...(physical.tags || []), ...(rule.extra_tags || [])])]
  physical.required_weapon_proficiencies = [...new Set([...(physical.required_weapon_proficiencies || []), ...(rule.extra_proficiencies || [])])]
  if (rule.range_min != null) physical.range_min = rule.range_min
  if (rule.range_max != null) physical.range_max = rule.range_max
  return { ...item, data: { ...item.data, ...physical, subtype: base.name } }
}

export function equippedMagicWeapons(values, itemsById) {
  return (values?.items?.equipped || []).flatMap(entry => {
    const item = itemsById[entry.item_id]
    if (!entry.uid || Number(entry.count ?? 1) <= 0 || !resolveMagicWeapon(item, entry, itemsById)) return []
    return [{ ...entry.params?._weapon_state, uid: entry.uid, item_id: entry.item_id,
      params: entry.params || {}, _inventory: true, _key: entry.uid }]
  })
}

export function intrinsicWeaponBonus(entry, item, values) {
  return entry?._inventory && magicItemActive(item?.data?.weapon?.bonus_without_attunement ? { ...item, data: { ...item.data, attunement: 'none' } } : item, entry, true, values) ? Number(item.data?.weapon?.magic_bonus) || 0 : 0
}

// The weapon row is a view of the inventory instance; never persist a second copy.
export function saveMagicWeaponRows(items, rows) {
  const byUid = new Map(rows.filter(e => e._inventory).map(e => [e.uid, e]))
  return mapInventoryEntries(items, entry => {
    const row = byUid.get(entry.uid)
    if (!row) return entry
    const { stat_suggest_id, proficient, add_attacks, desc } = row
    return { ...entry, params: { ...entry.params, magic_bonus: row.params?.magic_bonus || 0, _weapon_state: { stat_suggest_id, proficient, add_attacks, desc } } }
  })
}
