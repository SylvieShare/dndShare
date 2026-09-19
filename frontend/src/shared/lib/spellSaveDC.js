export function resolveSpellSaveDC(rule, calculated) {
  const fixed = Number(rule?.save_dc)
  return Number.isInteger(fixed) && fixed > 0 && fixed <= 100 ? fixed : calculated
}
