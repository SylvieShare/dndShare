// A floor applies to the final AC, including armor, shields and bonuses.
// Several floors compete; they never add to each other or to the armor formula.
export function applyArmorMinimum(total, rules = []) {
  const minimum = rules.filter(rule => Number.isFinite(Number(rule.value)) && Number(rule.value) > 0)
    .reduce((best, rule) => !best || Number(rule.value) > Number(best.value) ? rule : best, null)
  return { total: Math.max(total, Number(minimum?.value) || 0), minimum }
}
