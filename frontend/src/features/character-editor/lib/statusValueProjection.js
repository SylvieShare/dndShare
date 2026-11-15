import { collectStatusDerivedEffects } from './characterStatuses'
import { resolveNumValue } from '@/shared/lib/dnd'
import { SUGGEST16_TO_STAT } from '@/shared/lib/dndStats'
import { abilityScoreWithEffects } from './abilityScoreEffects'

// A read model only. The persisted base and its user bonuses stay untouched;
// removing the status immediately restores the original ability score.
export function statusValueProjection(values, items) {
  let result = values
  const effects = collectStatusDerivedEffects(values, items)
  for (const [id, key] of Object.entries(SUGGEST16_TO_STAT)) {
    const stat = values[key] || {}
    const current = resolveNumValue(stat.value ?? 10)
    const next = abilityScoreWithEffects(current, id, effects)
    if (next === current) continue
    if (result === values) result = { ...values }
    result[key] = { ...stat, value: { base: next, bonuses: [] } }
  }
  return result
}
