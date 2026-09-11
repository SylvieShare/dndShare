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
  const next = Math.max(0, int(base))
  const recorded = next === maximum.base ? hp : appendHpHistory(hp, { kind: 'manual', gain: next - maximum.base })
  return { ...recorded, max: { ...maximum, base: next } }
}

/** Preserve only recorded gains; never infer past rolls from today's classes. */
export function appendHpHistory(hp, entry) {
  const history = Array.isArray(hp?.history) ? [...hp.history] : []
  const recorded = history.reduce((sum, row) => sum + int(row.gain), 0)
  const remainder = normalizeHpMaximum(hp?.max).base - recorded
  if (remainder) history.push({ kind: 'untracked', gain: remainder })
  history.push(entry)
  return { ...hp, history }
}

export function withHpBonuses(hp, bonuses) {
  const maximum = normalizeHpMaximum(hp?.max)
  return { ...hp, max: { ...maximum, bonuses: Array.isArray(bonuses) ? bonuses : [] } }
}
