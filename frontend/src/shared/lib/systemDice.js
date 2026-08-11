const DEFINITIONS = [
  { id: 4, sides: 4, value: 'd4', color: '#e07b54', shape: 'd4' },
  { id: 6, sides: 6, value: 'd6', color: '#e0c454', shape: 'd6' },
  { id: 8, sides: 8, value: 'd8', color: '#7ab8e8', shape: 'd8' },
  { id: 10, sides: 10, value: 'd10', color: '#a07ae8', shape: 'd10' },
  { id: 12, sides: 12, value: 'd12', color: '#7ae8a0', shape: 'd12' },
  { id: 20, sides: 20, value: 'd20', color: '#e87a9f', shape: 'd20' },
  { id: 100, sides: 100, value: 'd100', color: '#55c9c2', shape: 'd10' },
]

export const SYSTEM_DICE = Object.freeze(DEFINITIONS.map((die) => Object.freeze({ ...die })))
export const HIT_DICE = Object.freeze(SYSTEM_DICE.filter((die) => die.sides <= 12))

const BY_ID = new Map(SYSTEM_DICE.map((die) => [String(die.id), die]))

export function diceById(id) {
  return BY_ID.get(String(id)) || null
}

export function dieSides(value) {
  if (value && typeof value === 'object') value = value.sides ?? value.id ?? value.value
  const match = String(value ?? '').trim().match(/^d?(4|6|8|10|12|20|100)$/i)
  return match ? Number(match[1]) : null
}

export function diceByValue(value) {
  const sides = dieSides(value)
  return sides == null ? null : diceById(sides)
}

export function dieLabel(value) {
  return diceByValue(value)?.value || ''
}
