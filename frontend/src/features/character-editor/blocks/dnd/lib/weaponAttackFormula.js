export function weaponAttackFormula(summary, rules = [], excluded = []) {
  const mode = summary.mode
  const bonuses = rules.filter(rule => !excluded.includes(rule.key))
    .map(rule => ({ source: rule.source_label || 'Бонус', expression: rule.formula }))
  return [{
    key: 'attack-roll', roll: true,
    source: mode === 'advantage' ? 'Преимущество' : mode === 'disadvantage' ? 'Помеха' : 'Бросок',
    expression: ['advantage', 'disadvantage'].includes(mode) ? '2d20' : '1d20',
  }, ...summary.parts, ...bonuses]
}

export function weaponAttackColor(mode) {
  return mode === 'advantage' ? 'var(--success)' : mode === 'disadvantage' ? 'var(--danger)' : 'var(--accent-soft)'
}
