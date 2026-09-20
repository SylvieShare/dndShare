import { STAT_KEYS } from './dndStats'

// A pattern is a multiset of bonuses, each assigned to a different ability.
export function bonusGroups(pattern) {
  return [...new Set(pattern)].map(bonus => ({ bonus, count: pattern.filter(value => value === bonus).length }))
}

export function validBonusSelection(value, allowed, pattern) {
  const remaining = [...pattern]
  return Object.entries(value || {}).every(([stat, bonus]) => {
    if (!STAT_KEYS.includes(stat) || !allowed.includes(stat)) return false
    const index = remaining.indexOf(Number(bonus))
    if (index < 0) return false
    remaining.splice(index, 1)
    return true
  })
}

export function normalizeBonusSelection(value, allowed, pattern) {
  const result = {}
  for (const stat of allowed) {
    if (!(Number(value?.[stat]) > 0)) continue
    const candidate = { ...result, [stat]: Number(value[stat]) }
    if (validBonusSelection(candidate, allowed, pattern)) Object.assign(result, candidate)
  }
  return result
}

export function toggleBonusSelection(value, stat, bonus, allowed, pattern) {
  const next = { ...value }
  if (Number(next[stat]) === bonus) delete next[stat]
  else if (next[stat] != null) return value
  else next[stat] = bonus
  return validBonusSelection(next, allowed, pattern) ? next : value
}
