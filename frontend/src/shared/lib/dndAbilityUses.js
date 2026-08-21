import { abilityModifier, resolveNumValue } from '@/shared/lib/dnd'
import { SUGGEST16_TO_STAT } from '@/shared/lib/dndStats'

function nonNegativeInt(value) {
  return Math.max(0, Math.floor(Number(value) || 0))
}

/** Resolve the live charge maximum configured on an ability handbook item. */
export function abilityUseTotal(itemData, values = {}, storedEntry = {}) {
  const data = itemData || {}
  const stat = SUGGEST16_TO_STAT[Number(data.max_use_stat)]
  if (stat) {
    const modifier = abilityModifier(resolveNumValue(values?.[stat]?.value))
    const minimum = data.max_use_min == null ? 1 : nonNegativeInt(data.max_use_min)
    return Math.max(minimum, modifier)
  }

  if (data.manual_size) return nonNegativeInt(storedEntry.max_use ?? data.max_use)

  if (data.max_use == null || data.max_use === '') return null
  return nonNegativeInt(data.max_use)
}

export function abilityUsesAreManual(itemData) {
  const data = itemData || {}
  return !!data.manual_size && !SUGGEST16_TO_STAT[Number(data.max_use_stat)]
}
