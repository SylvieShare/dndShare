import { computed } from 'vue'
import {
  collectCharacterCombatEffects,
  extraCriticalWeaponDice,
  matchingRollAdjustments,
  matchingWeaponDamageActions,
  matchingRollTriggers,
} from '@/features/character-editor/lib/characterCombatEffects'

export function useCharacterCombatEffects(values, itemsById) {
  const effects = computed(() => collectCharacterCombatEffects(values.value, itemsById.value))
  return {
    effects,
    rollTriggers(scope) { return matchingRollTriggers(effects.value, scope) },
    rollAdjustments(scope, context) { return matchingRollAdjustments(effects.value, scope, context) },
    extraCriticalWeaponDice(context) { return extraCriticalWeaponDice(effects.value, context) },
    weaponDamageActions(context) { return matchingWeaponDamageActions(effects.value, context) },
  }
}
