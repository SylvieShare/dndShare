import { abilityModifier, proficiencyBonus, resolveNumValue, sumBonuses } from '@/shared/lib/dnd'
import { collectCharacterDerivedEffects, derivedArmorRules, derivedGrantedProficiencies, derivedNumericBonus, derivedProficiency, derivedRollEffects, matchingDerivedEffects } from '@/features/character-editor/lib/characterDerivedEffects'
import { deriveEquippedArmor } from '@/features/character-editor/blocks/dnd/lib/equippedArmor'
import { resolveRollMode } from '@/features/character-editor/blocks/dnd/lib/rollMode'
import { statusValueProjection } from '@/features/character-editor/lib/statusValueProjection'

export const PASSIVE_SKILLS = [
  { id: '10', stat: 'WIS', ability: 5, label: 'Пассивная внимательность' },
  { id: '9', stat: 'INT', ability: 4, label: 'Пассивное расследование' },
]

export function participantDefenses(values, items = new Map(), suggestItems = () => [], rulesVersion = '2014') {
  values = statusValueProjection(values, items)
  const effects = collectCharacterDerivedEffects(values, items)
  const mastery = values.prof_bonus || {}
  const proficiency = (mastery.auto === false ? Number(mastery.v) || 0 : proficiencyBonus(values.lvl?.level || 1)) + sumBonuses(mastery.bonuses)
  const armor = deriveEquippedArmor(values, items, suggestItems, derivedArmorRules(effects), derivedGrantedProficiencies(effects, 'armor_proficiency'), rulesVersion)
  const passives = PASSIVE_SKILLS.map(skill => {
    const saved = values[skill.stat]?.skills?.[skill.id] || {}
    const context = { kind: 'skill_check', skillId: skill.id, abilitySuggestId: skill.ability }
    const rank = Math.max(Number(saved.up) || 0, derivedProficiency(effects, 'skill_proficiency', context).rank)
    context.proficient = rank > 0
    let score = resolveNumValue(values[skill.stat]?.value ?? 10)
    for (const rule of matchingDerivedEffects(effects, 'ability_minimum', context)) score = Math.max(score, Number(rule.value) || 0)
    const bonus = abilityModifier(score) + rank * proficiency + sumBonuses(saved.bonuses) + derivedNumericBonus(effects, 'skill_bonus', values, context).total
    const mode = resolveRollMode(saved.roll_mode, derivedRollEffects(effects, context))
    const adjustment = mode.mode === 'advantage' ? 5 : mode.mode === 'disadvantage' ? -5 : 0
    return { ...skill, bonus, mode: mode.mode, value: 10 + bonus + adjustment,
      description: `10 ${bonus >= 0 ? '+' : '−'} ${Math.abs(bonus)}${adjustment ? ` ${adjustment > 0 ? '+ 5 (преимущество)' : '− 5 (помеха)'}` : ''}` }
  })
  return { armorClass: armor.total, passives }
}
