import { computed } from 'vue'
import {
  collectCharacterDerivedEffects,
  derivedArmorRules,
  derivedCriticalThreshold,
  derivedGrantedProficiencies,
  derivedNumericBonus,
  derivedProficiency,
  derivedRollEffects,
  derivedSpeedBonuses,
} from '@/features/character-editor/lib/characterDerivedEffects'

export function useCharacterDerivedEffects(values, itemsById) {
  const effects = computed(() => collectCharacterDerivedEffects(values.value, itemsById.value))
  return {
    effects,
    armorRules: computed(() => derivedArmorRules(effects.value)),
    speed(context) { return derivedSpeedBonuses(effects.value, context) },
    skillProficiency(skillId) { return derivedProficiency(effects.value, 'skill_proficiency', { kind: 'skill_check', skillId }) },
    toolProficiency(toolId) { return derivedProficiency(effects.value, 'tool_proficiency', { kind: 'tool', targetId: toolId }) },
    saveProficiency(abilitySuggestId) { return derivedProficiency(effects.value, 'save_proficiency', { kind: 'saving_throw', abilitySuggestId }) },
    grantedProficiencies(kind) { return derivedGrantedProficiencies(effects.value, kind) },
    bonus(kind, context) { return derivedNumericBonus(effects.value, kind, values.value, context) },
    rollEffects(context) { return derivedRollEffects(effects.value, context) },
    criticalThreshold(context) { return derivedCriticalThreshold(effects.value, context) },
  }
}
