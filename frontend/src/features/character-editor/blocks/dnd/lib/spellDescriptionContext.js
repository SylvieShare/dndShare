import { SUGGEST16_TO_STAT } from '@/shared/lib/dndStats'
import { abilityModifier, resolveNumValue } from '@/shared/lib/dnd'
import { CALCULATION_VARIABLES } from '@/shared/lib/richCalculation'

export function spellDescriptionContext({ entry, values, stats, castingAbility, abilityLabel, profBonus, saveDC, attackBonus }) {
  const context = {
    prof_bonus: { value: profBonus },
    char_level: { value: Number(values?.lvl?.level) || 1 },
    cast_level: { value: Number(entry.ref?.cast_level) || Number(entry.item?.data?.lvl) || 0 },
    spell_dc: { value: saveDC },
    spell_attack: { value: attackBonus },
  }
  for (const [id, stat] of Object.entries(SUGGEST16_TO_STAT)) {
    const score = values?.[stat]?.value
    const modifier = stats?.[id] ?? (score == null ? null : abilityModifier(resolveNumValue(score)))
    context[`${stat.toLowerCase()}_mod`] = { value: modifier == null ? null : Number(modifier) }
  }
  const stat = SUGGEST16_TO_STAT[castingAbility]
  context.casting_mod = {
    value: stat ? context[`${stat.toLowerCase()}_mod`].value : null,
    label: abilityLabel ? `Модификатор: ${abilityLabel}` : CALCULATION_VARIABLES.casting_mod,
  }
  return context
}
