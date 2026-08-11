/**
 * Shared display labels + tiny formatters for the D&D create wizard steps.
 * Kept out of the composable so presentational components share one source.
 */

import { STAT_FULL, STAT_SHORT, SUGGEST16_TO_STAT } from '@/shared/lib/dndStats'
import { formatBonus } from '@/shared/lib/dnd'
import { dieLabel } from '@/shared/lib/systemDice'

export { STAT_FULL, STAT_SHORT, SUGGEST16_TO_STAT }
export { formatBonus as formatMod }

export function monogramOf(name) {
  return String(name || '?').trim().charAt(0).toUpperCase()
}

/** "+2 ЛОВ · +1 ИНТ" from a race/subrace item's `data.asi`. */
export function asiSummary(item) {
  const asi = item?.data?.asi
  if (!Array.isArray(asi) || !asi.length) return ''
  return asi
    .map((a) => {
      const stat = SUGGEST16_TO_STAT[Number(a?.ability)]
      const bonus = Number(a?.bonus) || 0
      return stat ? `+${bonus} ${STAT_SHORT[stat]}` : ''
    })
    .filter(Boolean)
    .join(' · ')
}

/** "d6 · ИНТ" — hit die face + primary ability, for a class item. */
export function classSummary(item, suggestValue) {
  const die = dieLabel(item?.data?.hit_die)
  const prim = (item?.data?.primary_abilities || [])
    .map((id) => STAT_SHORT[SUGGEST16_TO_STAT[Number(id)]])
    .filter(Boolean)
    .join('/')
  return [die, prim].filter(Boolean).join(' · ')
}
