import { FEATURE_VALUE_IDS, featureEntries } from './characterMagicItems'
import { featureEntryActive } from './featureEntryState'
import { abilityOwnerLevel } from '@/shared/lib/dndAbilityUses'
import { abilityModifier, resolveNumValue } from '@/shared/lib/dnd'
import { SUGGEST16_TO_STAT } from '@/shared/lib/dndStats'

export function collectCharacterSpellModifiers(values, itemsById) {
  return FEATURE_VALUE_IDS.flatMap(valueId => featureEntries(values, valueId, itemsById).flatMap(entry => {
    if (!featureEntryActive(valueId, entry)) return []
    const item = itemsById.get(String(entry.id))
    if (!item || abilityOwnerLevel(item.data, values) < Number(item.data.level || 1)) return []
    return (item.data.spell_modifiers || []).map(rule => ({
      spellId: String(rule.spell_id?.id ?? rule.spell_id),
      damageBonus: rule.damage_ability ? abilityModifier(resolveNumValue(values?.[SUGGEST16_TO_STAT[rule.damage_ability]]?.value)) : 0,
      range: rule.range || '',
    }))
  }))
}
