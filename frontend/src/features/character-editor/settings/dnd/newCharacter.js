/**
 * Hardcoded blank D&D 5e character.
 *
 * The create flow seeds a fresh character from `blankValues()` and then layers
 * race/class grants and the chosen ability scores on top (see
 * `creation/grants.js`).
 *
 * Keep this in sync with the D&D sheet blocks (`settings/dnd/blocks.json`): the
 * keys here are block ids under `values`.
 */

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

const PRESET = {
  lvl: { level: 1, exp: 0 },
  speed: { base: 30, bonuses: [] },
  hp: { max: 10, current: 10, hitDice: [{ die: 'd8', total: 1, used: 0 }] },
  armor: { ac: 10, shield: false, bonuses: [], shield_bonus: 2 },
  initiative: { base: 0, bonuses: [], use_dex: true },
  STR: { value: 10 },
  DEX: { value: 10 },
  CON: { value: 10 },
  INT: { value: 10 },
  WIS: { value: 10 },
  CHA: { value: 10 },
  prof_bonus: { v: 2, auto: true },
  money: { order: [1, 2, 3, 4, 5], amounts: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } },
}

/** The blank `values` payload only (no wrapper). */
export function blankValues() {
  return clone(PRESET)
}
