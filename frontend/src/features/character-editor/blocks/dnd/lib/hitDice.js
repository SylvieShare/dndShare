/**
 * Hit-dice pool helpers.
 *
 * Sheets store one row per die type in `hp.hitDice`:
 * `[{ die: 'd10', total: 3, used: 1 }]`.
 */

export const HIT_DIE_TYPES = ['d4', 'd6', 'd8', 'd10', 'd12']

export function normalizeHitDie(value, fallback = 'd8') {
  const face = String(value ?? '').match(/(\d+)/)?.[1]
  return face ? `d${Number(face)}` : fallback
}

function positiveInt(value, fallback = 0) {
  const n = Math.floor(Number(value))
  return Number.isFinite(n) && n > 0 ? n : fallback
}

function nonNegativeInt(value) {
  const n = Math.floor(Number(value))
  return Number.isFinite(n) && n > 0 ? n : 0
}

export function normalizeHitDice(hp) {
  const source = Array.isArray(hp?.hitDice) ? hp.hitDice : []
  const merged = []

  for (const raw of source) {
    const total = positiveInt(raw?.total)
    if (!total) continue
    const die = normalizeHitDie(raw?.die)
    const used = Math.min(total, nonNegativeInt(raw?.used))
    const existing = merged.find((row) => row.die === die)
    if (existing) {
      existing.total += total
      existing.used += used
    } else {
      merged.push({ die, total, used })
    }
  }

  return merged.map((row) => ({ ...row, used: Math.min(row.total, row.used) }))
}

export function hitDiceTotal(pools) {
  return (pools || []).reduce((sum, row) => sum + positiveInt(row?.total), 0)
}

export function hitDiceUsed(pools) {
  return (pools || []).reduce((sum, row) => sum + Math.min(positiveInt(row?.total), nonNegativeInt(row?.used)), 0)
}

export function hitDiceRemaining(pools) {
  return Math.max(0, hitDiceTotal(pools) - hitDiceUsed(pools))
}

/** Store normalized pools in the canonical HP object. */
export function withHitDice(hp, pools) {
  const normalized = normalizeHitDice({ hitDice: pools })
  return {
    ...(hp || {}),
    hitDice: normalized,
  }
}

export function addHitDie(hp, die) {
  const pools = normalizeHitDice(hp).map((row) => ({ ...row }))
  const normalizedDie = normalizeHitDie(die, pools[0]?.die || 'd8')
  const row = pools.find((entry) => entry.die === normalizedDie)
  if (row) row.total += 1
  else pools.push({ die: normalizedDie, total: 1, used: 0 })
  return withHitDice(hp, pools)
}

export function setHitDieUsed(hp, die, used) {
  const normalizedDie = normalizeHitDie(die)
  const pools = normalizeHitDice(hp).map((row) => row.die === normalizedDie
    ? { ...row, used: Math.max(0, Math.min(row.total, nonNegativeInt(used))) }
    : { ...row })
  return withHitDice(hp, pools)
}

export function changeHitDieType(hp, fromDie, toDie) {
  const from = normalizeHitDie(fromDie)
  const to = normalizeHitDie(toDie)
  const pools = normalizeHitDice(hp).map((row) => ({ ...row }))
  const source = pools.find((row) => row.die === from)
  if (!source || from === to) return withHitDice(hp, pools)
  const target = pools.find((row) => row.die === to)
  if (target) {
    target.total += source.total
    target.used += source.used
    pools.splice(pools.indexOf(source), 1)
  } else {
    source.die = to
  }
  return withHitDice(hp, pools)
}

/**
 * Rebuild pools from class levels while preserving per-type usage.
 */
export function hitDiceFromClasses(hp, entries, dieForEntry) {
  const pools = []
  for (const entry of entries || []) {
    const die = normalizeHitDie(dieForEntry?.(entry), '')
    const total = positiveInt(entry?.level)
    if (!die || !total) continue
    const row = pools.find((item) => item.die === die)
    if (row) row.total += total
    else pools.push({ die, total, used: 0 })
  }
  if (!pools.length) return normalizeHitDice(hp)

  const old = normalizeHitDice(hp)
  pools.forEach((row) => {
    row.used = Math.min(row.total, old.find((item) => item.die === row.die)?.used || 0)
  })
  return pools
}

export function formatHitDice(pools) {
  return (pools || []).map((row) => `${Math.max(0, row.total - row.used)}/${row.total} ${row.die}`).join(' · ')
}
