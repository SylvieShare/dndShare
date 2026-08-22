function int(value) {
  return Math.trunc(Number(value) || 0)
}

export function normalizeHpMaximum(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return {
      base: Math.max(0, int(value.base)),
      bonuses: Array.isArray(value.bonuses) ? value.bonuses.map((bonus) => ({ ...bonus })) : [],
    }
  }
  return { base: Math.max(0, int(value)), bonuses: [] }
}

export function hpMaximum(value) {
  const maximum = normalizeHpMaximum(value?.max ?? value)
  return Math.max(0, maximum.base + maximum.bonuses.reduce((sum, bonus) => sum + int(bonus?.value), 0))
}

export function withHpBase(hp, base) {
  const maximum = normalizeHpMaximum(hp?.max)
  return { ...hp, max: { ...maximum, base: Math.max(0, int(base)) } }
}

export function withHpBonuses(hp, bonuses) {
  const maximum = normalizeHpMaximum(hp?.max)
  return { ...hp, max: { ...maximum, bonuses: Array.isArray(bonuses) ? bonuses : [] } }
}

