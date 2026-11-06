import { ownedFeatureRules } from './ownedFeatureRules'
import { abilityModifier, resolveNumValue } from '@/shared/lib/dnd'
import { SUGGEST16_TO_STAT } from '@/shared/lib/dndStats'

export function collectCharacterSpellModifiers(values, itemsById) {
  return [...ownedFeatureRules(values, itemsById, 'spell_modifiers')].filter(({ item, ownerLevel }) =>
    ownerLevel >= Number(item.data.level || 1)
  ).map(({ rule }) => ({
    spellId: String(rule.spell_id?.id ?? rule.spell_id),
    damageBonus: rule.damage_ability ? abilityModifier(resolveNumValue(values?.[SUGGEST16_TO_STAT[rule.damage_ability]]?.value)) : 0,
    range: rule.range || '',
  }))
}
