import { abilityModifier, resolveNumValue } from '@/shared/lib/dnd'
import { SUGGEST16_TO_STAT } from '@/shared/lib/dndStats'

const STRENGTH_SUGGEST_ID = 1
const DEXTERITY_SUGGEST_ID = 2

function labelOf(property) {
  if (property == null) return ''
  if (typeof property === 'object') {
    return String(property.label ?? property.value ?? property.name ?? property.title ?? '')
  }
  return String(property)
}

function normalized(value) {
  return String(value || '').trim().toLocaleLowerCase('ru').replace(/ё/g, 'е')
}

export function abilityModifiersBySuggest(values = {}) {
  return Object.fromEntries(Object.entries(SUGGEST16_TO_STAT).map(([suggestId, stat]) => [
    suggestId,
    values?.[stat]?.value == null ? 0 : abilityModifier(resolveNumValue(values[stat].value)),
  ]))
}

export function isFinesseWeapon(item, properties = []) {
  const rawTags = Array.isArray(item?.data?.tags) ? item.data.tags : []
  return [...properties, ...rawTags]
    .map(labelOf)
    .map(normalized)
    .some((label) => label.includes('фехтовал') || label.includes('finesse'))
}

export function weaponAbilitySuggestId(entry, item, properties = [], stats = {}) {
  if (entry?.stat_suggest_id != null && String(entry.stat_suggest_id).trim() !== '') {
    return entry.stat_suggest_id
  }
  if (isFinesseWeapon(item, properties)) {
    const strength = Number(stats[String(STRENGTH_SUGGEST_ID)]) || 0
    const dexterity = Number(stats[String(DEXTERITY_SUGGEST_ID)]) || 0
    return dexterity > strength ? DEXTERITY_SUGGEST_ID : STRENGTH_SUGGEST_ID
  }
  if (item?.data?.is_long_range) return DEXTERITY_SUGGEST_ID
  return STRENGTH_SUGGEST_ID
}

export function weaponAbilityModifier(entry, item, properties = [], stats = {}) {
  const suggestId = weaponAbilitySuggestId(entry, item, properties, stats)
  return Number(stats[String(suggestId)]) || 0
}
