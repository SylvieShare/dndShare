import { collectStatusDerivedEffects } from './characterStatuses'
import { resolveNumValue } from '@/shared/lib/dnd'
import { SUGGEST16_TO_STAT } from '@/shared/lib/dndStats'

// A read model only. The persisted base and its user bonuses stay untouched;
// removing the status immediately restores the original ability score.
export function statusValueProjection(values, items) {
  let result = values
  for (const rule of collectStatusDerivedEffects(values, items)) {
    if (rule.kind !== 'ability_minimum') continue
    for (const id of rule.ability_ids || []) {
      const key = SUGGEST16_TO_STAT[id]
      if (!key) continue
      const stat = result[key] || {}
      const current = resolveNumValue(stat.value)
      if (!(Number(rule.value) > current)) continue
      if (result === values) result = { ...values }
      result[key] = { ...stat, value: { base: Number(rule.value), bonuses: [] } }
    }
  }
  return result
}
