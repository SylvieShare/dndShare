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
  const dice = Array.from({ length: 4 }, () => 1 + Math.floor(Math.random() * 6))
  dice.sort((a, b) => a - b)
  return dice[1] + dice[2] + dice[3]
}
