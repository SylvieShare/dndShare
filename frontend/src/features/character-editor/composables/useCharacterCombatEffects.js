import { confirmedItemUses, confirmItemUse } from '@/features/character-editor/lib/confirmedItemUses'
import { computed, onScopeDispose } from 'vue'
import {
  collectCharacterCombatEffects,
  extraCriticalWeaponDice,
  matchingRollAdjustments,
  matchingWeaponDamageActions,
  matchingRollTriggers,
} from '@/features/character-editor/lib/characterCombatEffects'

export function useCharacterCombatEffects(values, itemsById, charCtx = {}) {
  let alive = true
  onScopeDispose(() => { alive = false })
  const effects = computed(() => collectCharacterCombatEffects(values.value, itemsById.value))
  return {
    effects,
    rollTriggers(scope) {
      return matchingRollTriggers(effects.value, scope).flatMap(rule => {
        if (!rule.use_key) return [rule]
        const uid = rule.resource_owner?.entryKey
        const use = confirmedItemUses(values.value, itemsById.value, uid).find(row => row.key === rule.use_key)
        if (!charCtx.ownerMode || !use || use.error) return []
        return [{ ...rule, useRef: { uid, key: use.key }, consume() {
          if (!alive || !charCtx.ownerMode) return false
          const patch = confirmItemUse(values.value, itemsById.value, uid, use.key, true)
          if (!Object.keys(patch).length) return false
          charCtx.updateValues(patch)
          charCtx.logSessionEvent?.({ type: 'feature_state', action: `${use.item.name}: ${use.title}`, data: { instanceUid: uid, resourceSpent: use.resource_cost } })
          return true
        } }]
      })
    },
    rollAdjustments(scope, context) { return matchingRollAdjustments(effects.value, scope, context) },
    extraCriticalWeaponDice(context) { return extraCriticalWeaponDice(effects.value, context) },
    weaponDamageActions(context) { return matchingWeaponDamageActions(effects.value, context) },
  }
}
