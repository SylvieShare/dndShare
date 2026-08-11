const DEFINITIONS = [
  { id: 'd4', sides: 4, value: 'd4', legacyId: 1, color: '#e07b54', shape: 'd4' },
  { id: 'd6', sides: 6, value: 'd6', legacyId: 2, color: '#e0c454', shape: 'd6' },
  { id: 'd8', sides: 8, value: 'd8', legacyId: 3, color: '#7ab8e8', shape: 'd8' },
  { id: 'd10', sides: 10, value: 'd10', legacyId: 4, color: '#a07ae8', shape: 'd10' },
  { id: 'd12', sides: 12, value: 'd12', legacyId: 5, color: '#7ae8a0', shape: 'd12' },
  { id: 'd20', sides: 20, value: 'd20', legacyId: 6, color: '#e87a9f', shape: 'd20' },
  { id: 'd100', sides: 100, value: 'd100', legacyId: 7, color: '#55c9c2', shape: 'd10' },
]

export const SYSTEM_DICE = Object.freeze(DEFINITIONS.map((die) => Object.freeze({ ...die })))
export const HIT_DICE = Object.freeze(SYSTEM_DICE.filter((die) => die.sides <= 12))

const BY_ID = new Map(SYSTEM_DICE.map((die) => [String(die.id), die]))

export function diceById(id) {
  return BY_ID.get(String(id).toLowerCase()) || null
}

export function dieSides(value) {
  if (value && typeof value === 'object') value = value.sides ?? value.id ?? value.value
  const match = String(value ?? '').trim().match(/^d?(4|6|8|10|12|20|100)$/i)
  return match ? Number(match[1]) : null
}

export function diceByValue(value) {
  if (value && typeof value === 'object') value = value.id ?? value.value ?? value.sides
  const byId = diceById(value)
  if (byId) return byId
  const sides = dieSides(value)
  return sides == null ? null : SYSTEM_DICE.find((die) => die.sides === sides) || null
}

export function dieLabel(value) {
  return diceByValue(value)?.value || ''
}
