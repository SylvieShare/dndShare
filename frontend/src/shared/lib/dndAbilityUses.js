import { validChargeCount } from './itemInitialCharges'
import { abilityLevelContext } from './abilityLevelSource'
import { automaticAbilityLabel } from './abilityProgression'
import { abilityModifier, resolveNumValue } from '@/shared/lib/dnd'
import { SUGGEST16_TO_STAT } from '@/shared/lib/dndStats'

function nonNegativeInt(value) {
  return Math.max(0, Math.floor(Number(value) || 0))
}

export function abilityOwnerLevel(itemData, values = {}) {
  return abilityLevelContext(itemData || {}, values).level
}

/** Resolve the live charge maximum configured on an ability handbook item. */
export function abilityUseTotal(ruleData, values = {}, storedEntry = {}, ownerData = ruleData) {
  const rule = ruleData || {}
  const owner = ownerData || rule
  const ownerLevel = abilityOwnerLevel(owner, values)
  // Top-level feature `level` is acquisition metadata. A nested resource level
  // is an actual unlock gate (for example the two Drow Magic spells).
  if (rule !== owner && rule.level != null && ownerLevel < nonNegativeInt(rule.level)) return null

  if (rule.initial_charges) return validChargeCount(storedEntry.max_use) ? Number(storedEntry.max_use) : null

  const stat = SUGGEST16_TO_STAT[Number(rule.max_use_stat)]
  if (stat) {
    const modifier = abilityModifier(resolveNumValue(values?.[stat]?.value))
    const multiplier = Number(rule.max_use_stat_multiplier) || 1
    const bonus = Number(rule.max_use_bonus) || 0
    const minimum = rule.max_use_min == null ? 1 : nonNegativeInt(rule.max_use_min)
    return Math.max(minimum, Math.floor(modifier * multiplier + bonus))
  }

  if (rule.max_use_level_multiplier != null) {
    const multiplier = Number(rule.max_use_level_multiplier) || 0
    const bonus = Number(rule.max_use_bonus) || 0
    const minimum = rule.max_use_min == null ? 0 : nonNegativeInt(rule.max_use_min)
    return Math.max(minimum, Math.floor(ownerLevel * multiplier + bonus))
  }

  if (rule.max_use_scaling) {
    const rows = (Array.isArray(owner.scaling) ? owner.scaling : [])
      .filter((row) => row?.uses != null && nonNegativeInt(row.level) <= ownerLevel)
      .sort((left, right) => nonNegativeInt(right.level) - nonNegativeInt(left.level))
    if (rows.length) return nonNegativeInt(rows[0].uses)
  }

  if (rule.manual_size) return nonNegativeInt(storedEntry.max_use ?? rule.max_use)

  if (rule.max_use == null || rule.max_use === '') return null
  return nonNegativeInt(rule.max_use)
}

export function abilityUsesAreManual(itemData) {
  const data = itemData || {}
  return !!data.manual_size
    && !SUGGEST16_TO_STAT[Number(data.max_use_stat)]
    && data.max_use_level_multiplier == null
    && !data.max_use_scaling
}

/** Whether handbook data contributes at least one finite-use resource. */
export function abilityHasResources(itemData) {
  const data = itemData || {}
  if (Array.isArray(data.use_resources) && data.use_resources.some(Boolean)) return true
  return !!data.initial_charges || data.max_use != null
    || !!SUGGEST16_TO_STAT[Number(data.max_use_stat)]
    || data.max_use_level_multiplier != null
    || !!data.max_use_scaling
}

/** Current short label from a generic level-based display progression. */
export function abilityScalingLabel(itemData, values = {}) {
  const rows = (Array.isArray(itemData?.display_scaling) ? itemData.display_scaling : [])
    .filter((row) => row?.label && nonNegativeInt(row.level) <= abilityOwnerLevel(itemData, values))
    .sort((left, right) => nonNegativeInt(right.level) - nonNegativeInt(left.level))
  return rows[0]?.label ? String(rows[0].label) : automaticAbilityLabel(itemData, abilityOwnerLevel(itemData, values))
}
