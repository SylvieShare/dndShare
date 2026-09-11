import { magicBaseId } from '@/features/items/lib/magicEquipmentBases'
import { magicItemActive } from './characterMagicItems'
export const armorBaseId = (item, entry) => magicBaseId(item, entry?.params, 'armor_base')
export function resolveMagicArmor(item, entry, items, values = {}) {
  if (Number(item?.typeId) !== 19) return item
  const id = armorBaseId(item, entry)
  const base = items instanceof Map ? items.get(String(id)) || items.get(id) : items?.[id]
  if (Number(base?.typeId) !== 12 || !base.data?.armor) return null
  if (entry?.params?.magic?.lost) return base
  const rule = item.data.armor_base
  const active = magicItemActive(rule.bonus_without_attunement ? { ...item, data: { ...item.data, attunement: 'none' } } : item, entry, true, values)
  const armor = { ...base.data.armor }
  const key = armor.shield ? 'shield_bonus' : 'ac'
  armor[key] = Number(armor[key] ?? (armor.shield ? 2 : 10)) + (active ? Number(rule.magic_bonus) || 0 : 0)
  return { ...item, data: { ...item.data, armor, category: base.data.category, subtype: base.name,
    required_armor_proficiency: rule.grants_proficiency ? null : base.data.required_armor_proficiency,
    strength_required: rule.ignore_strength ? 0 : base.data.strength_required,
    stealth_disadvantage: !rule.ignore_stealth_disadvantage && base.data.stealth_disadvantage === true } }
}
