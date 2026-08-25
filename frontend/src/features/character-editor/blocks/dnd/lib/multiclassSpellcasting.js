import { FULL_CASTER_SLOTS, casterKindOf, pactSlots } from './levelUp'

function levelOf(entry) {
  return Math.max(0, Math.floor(Number(entry?.level) || 0))
}

function slotTotalsAt(casterLevel) {
  const totals = Array(9).fill(0)
  if (casterLevel <= 0) return totals
  const row = FULL_CASTER_SLOTS[Math.min(20, casterLevel) - 1] || []
  row.forEach((total, index) => { totals[index] = total })
  return totals
}

function ownCasterLevel(kind, level) {
  if (kind === 'full') return level
  if (kind === 'halfup') return Math.ceil(level / 2)
  if (kind === 'half') return level < 2 ? 0 : Math.ceil(level / 2)
  if (kind === 'third') return level < 3 ? 0 : Math.ceil(level / 3)
  return 0
}

function multiclassContribution(kind, level) {
  if (kind === 'full') return level
  if (kind === 'halfup') return Math.ceil(level / 2)
  if (kind === 'half') return Math.floor(level / 2)
  if (kind === 'third') return Math.floor(level / 3)
  return 0
}

function casterRows(entries, itemsById) {
  return (Array.isArray(entries) ? entries : []).map((entry) => ({
    entry,
    level: levelOf(entry),
    kind: casterKindOf(
      itemsById?.[entry?.id],
      entry?.subclass?.id != null ? itemsById?.[entry.subclass.id] : null,
    ),
  })).filter((row) => row.level > 0 && row.kind)
}

/**
 * D&D 5e 2014 slot pools. Spellcasting classes share one long-rest pool;
 * Pact Magic remains a separate short-rest pool even when it has the same
 * level as an ordinary slot.
 */
export function computeSpellSlotPools(entries, itemsById) {
  const rows = casterRows(entries, itemsById)
  const spellcasters = rows.filter((row) => row.kind !== 'pact')
  const pactLevel = rows
    .filter((row) => row.kind === 'pact')
    .reduce((total, row) => total + row.level, 0)

  const casterLevel = spellcasters.length <= 1
    ? (spellcasters[0] ? ownCasterLevel(spellcasters[0].kind, spellcasters[0].level) : 0)
    : spellcasters.reduce((total, row) => total + multiclassContribution(row.kind, row.level), 0)

  return {
    totals: slotTotalsAt(casterLevel),
    casterLevel,
    pact: pactSlots(pactLevel),
    isCaster: casterLevel > 0 || pactLevel > 0,
  }
}

/** Highest spell level this class can learn/prepare at its own class level. */
export function maximumSpellLevelForEntry(entry, itemsById) {
  const row = casterRows([entry], itemsById)[0]
  if (!row) return 0
  if (row.kind === 'pact') return pactSlots(row.level)?.slotLevel || 0
  const totals = slotTotalsAt(ownCasterLevel(row.kind, row.level))
  for (let index = totals.length - 1; index >= 0; index -= 1) {
    if (totals[index] > 0) return index + 1
  }
  return 0
}

