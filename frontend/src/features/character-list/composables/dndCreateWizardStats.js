import { STAT_KEYS } from '@/shared/lib/dndStats'

export const STATS = STAT_KEYS
export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8]
export const POINT_BUY_BUDGET = 27

const POINT_COST = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 }

export function pointCost(score) {
  return POINT_COST[score] ?? 0
}

export function emptyScores() {
  return Object.fromEntries(STATS.map((stat) => [stat, null]))
}

export function roll4d6DropLowest() {
  return roll4d6Series().total
}

export function roll4d6Series(random = Math.random) {
  const dice = Array.from({ length: 4 }, (_, index) => ({ id: index, value: 1 + Math.floor(random() * 6) }))
  const droppedId = [...dice].sort((a, b) => a.value - b.value || a.id - b.id)[0].id
  return {
    dice: dice.map(die => ({ ...die, dropped: die.id === droppedId })),
    total: dice.filter(die => die.id !== droppedId).reduce((sum, die) => sum + die.value, 0),
  }
}
