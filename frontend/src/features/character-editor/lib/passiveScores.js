import { abilityModifier, resolveNumValue, sumBonuses } from '@/shared/lib/dnd'
import { derivedNumericBonus, derivedProficiency, derivedRollEffects, matchingDerivedEffects } from './characterDerivedEffects'
import { resolveRollMode } from '../blocks/dnd/lib/rollMode'

export const PASSIVE_SKILLS = [
  { id: '10', stat: 'WIS', ability: 5, label: 'Пассивная внимательность' },
  { id: '9', stat: 'INT', ability: 4, label: 'Пассивное расследование' },
]

export function passiveScores(values, effects, proficiency) {
  return PASSIVE_SKILLS.map(skill => {
    const saved = values[skill.stat]?.skills?.[skill.id] || {}
    const context = { kind: 'skill_check', skillId: skill.id, abilitySuggestId: skill.ability }
    const rank = Math.max(Number(saved.up) || 0, derivedProficiency(effects, 'skill_proficiency', context).rank)
    context.proficient = rank > 0
    let score = resolveNumValue(values[skill.stat]?.value ?? 10)
    for (const rule of matchingDerivedEffects(effects, 'ability_minimum', context)) score = Math.max(score, Number(rule.value) || 0)
    const bonus = abilityModifier(score) + rank * proficiency + sumBonuses(saved.bonuses) + derivedNumericBonus(effects, 'skill_bonus', values, context).total
    const mode = resolveRollMode('auto', derivedRollEffects(effects, context))
    const adjustment = mode.mode === 'advantage' ? 5 : mode.mode === 'disadvantage' ? -5 : 0
    return { ...skill, bonus, mode: mode.mode, value: 10 + bonus + adjustment,
      description: `10 ${bonus >= 0 ? '+' : '−'} ${Math.abs(bonus)}${adjustment ? ` ${adjustment > 0 ? '+ 5 (преимущество)' : '− 5 (помеха)'}` : ''}` }
  })
}
