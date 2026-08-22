import { computed } from 'vue'
import {
  collectCharacterCombatEffects,
  extraCriticalWeaponDice,
  matchingRollTriggers,
} from '@/features/character-editor/lib/characterCombatEffects'

export function useCharacterCombatEffects(values, itemsById) {
  const effects = computed(() => collectCharacterCombatEffects(values.value, itemsById.value))
  return {
    effects,
    rollTriggers(scope) { return matchingRollTriggers(effects.value, scope) },
    extraCriticalWeaponDice(context) { return extraCriticalWeaponDice(effects.value, context) },
  }
}

