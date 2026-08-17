export const COMBAT_ACTION_SUGGEST_TYPE_ID = 24

const ACTION_ORDER = [
  'attack',
  'cast-spell',
  'dash',
  'disengage',
  'dodge',
  'help',
  'hide',
  'ready',
  'search',
  'use-object',
  'improvise',
]

const orderByCode = new Map(ACTION_ORDER.map((code, index) => [code, index]))

export function officialCombatActions(items) {
  return (Array.isArray(items) ? items : [])
    .filter(item => item?.userId == null && orderByCode.has(item?.code))
    .sort((left, right) => orderByCode.get(left.code) - orderByCode.get(right.code))
}
