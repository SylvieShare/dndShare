/** Additive score changes resolve before minimums, independently of effect order. */
export function abilityScoreWithEffects(score, abilityId, effects) {
  let bonus = 0, minimum = -Infinity
  for (const rule of effects || []) {
    if (!(rule.ability_ids || []).some(id => String(id) === String(abilityId))) continue
    const value = Number(rule.value)
    if (!Number.isFinite(value)) continue
    if (rule.kind === 'ability_bonus') bonus += value
    if (rule.kind === 'ability_minimum') minimum = Math.max(minimum, value)
  }
  return Math.max(score + bonus, minimum)
}
