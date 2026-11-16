// Core pp. 79–80. Call with effective BODY/WILL after relevant equipment effects.
export function redHealthMaximum(body, will) {
  if (![body, will].every(value => Number.isSafeInteger(value) && value >= 1 && value <= 100)) {
    throw new RangeError('BODY and WILL must be positive integer statistics')
  }
  return 10 + 5 * Math.ceil((body + will) / 2)
}

export function redWoundState(current, maximum) {
  if (!Number.isFinite(current) || !Number.isFinite(maximum) || maximum <= 0) throw new RangeError('Invalid health')
  const threshold = Math.ceil(maximum / 2)
  return { threshold, state: current <= 0 ? 'mortal' : current < threshold ? 'serious' : current < maximum ? 'light' : 'healthy' }
}

export function redHumanity({ baseEmpathy, current, maximumLoss = 0 }) {
  if (![baseEmpathy, current, maximumLoss].every(Number.isSafeInteger) || baseEmpathy < 0 || maximumLoss < 0) {
    throw new RangeError('Invalid humanity')
  }
  const maximum = Math.max(0, baseEmpathy * 10 - maximumLoss)
  return { maximum, current, empathy: Math.max(0, Math.min(baseEmpathy, Math.floor(current / 10))),
    cyberpsychosis: current < 0, exceedsMaximum: current > maximum }
}

export function redSkillBase(stats, skill, rank, modifiers = []) {
  const stat = stats?.[skill.statKey]
  if (!Number.isFinite(stat) || !Number.isInteger(rank) || rank < 0 || rank > 10) throw new RangeError('Invalid skill base')
  if (!modifiers.every(part => Number.isFinite(part.value))) throw new RangeError('Invalid modifier')
  return { value: stat + rank + modifiers.reduce((sum, part) => sum + part.value, 0), stat, rank, modifiers }
}
