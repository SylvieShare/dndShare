import { weaponBonusTransfer } from './weaponBonusTransfer'
import { magicBaseId } from '@/features/items/lib/magicEquipmentBases'
import { magicItemActive } from './characterMagicItems'

const PHYSICAL_KEYS = ['attacks', 'universe_attacks', 'tags', 'is_military', 'is_long_range', 'range_min', 'range_max', 'required_weapon_proficiencies']
export const weaponBaseId = (item, entry) => entry?.magic_item_id != null ? entry.item_id : magicBaseId(item, entry?.params, 'weapon')

/** Materialize only identity and instance state; handbook statistics stay referenced. */
export function createWeaponInstance(item, entry) {
  if (Number(item?.typeId) !== 19 || !item.data?.weapon) return entry
  const baseId = magicBaseId(item, entry.params, 'weapon')
  if (!baseId) return entry // Unconfigured inventory item remains available for choosing its base.
  const { weapon_base_item_id, ...params } = entry.params || {}
  return { ...entry, item_id: baseId, magic_item_id: item.id, params }
}

/** One resolver for rolls, inventory, print and instance details. Never mutate a source. */
export function resolveWeaponItem(entry, itemsById) {
  const base = itemsById[String(entry?.item_id)]
  if (!base) return null
  const source = !entry.params?.magic?.lost && entry.magic_item_id != null ? itemsById[String(entry.magic_item_id)] : null
  if (entry.magic_item_id != null && ((!source && !entry.params?.magic?.lost) || Number(base.typeId) !== 1)) return null
  let data = { ...base.data }
  if (source) {
    const physical = Object.fromEntries(PHYSICAL_KEYS.map(key => [key, base.data?.[key]]))
    const rule = source.data?.weapon || {}
    if (rule.damage_type != null) for (const key of ['attacks', 'universe_attacks']) physical[key] = (physical[key] || []).map(a => ({ ...a, type: rule.damage_type }))
    physical.tags = [...new Set([...(physical.tags || []), ...(rule.extra_tags || [])])]
    physical.required_weapon_proficiencies = [...new Set([...(physical.required_weapon_proficiencies || []), ...(rule.extra_proficiencies || [])])]
    if (rule.range_min != null) physical.range_min = rule.range_min
    if (rule.range_max != null) physical.range_max = rule.range_max
    data = { ...data, ...source.data, ...physical, subtype: base.name }
  }
  const identity = source || base
  return { ...identity, data: { ...data, ...entry.override }, name: entry.override?.name ?? identity.name }
}

export function intrinsicWeaponBonus(entry, item, values) {
  const bonusSource = item?.data?.weapon?.bonus_without_attunement
    ? { ...item, data: { ...item.data, attunement: 'none' } } : item
  if (entry?.magic_item_id == null || !magicItemActive(bonusSource, entry, true, values)) return 0
  const bonus = Number(item.data?.weapon?.magic_bonus) || 0
  return bonus - (weaponBonusTransfer(entry, item, values)?.value || 0)
}
