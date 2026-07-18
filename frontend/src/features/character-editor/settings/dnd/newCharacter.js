/**
 * Hardcoded blank D&D 5e character.
 *
 * This is the in-code replacement for the per-template `preset` that used to
 * live in the DB (`char_template.create_form.preset`). The create flow seeds a
 * fresh character from `blankValues()` and then layers race/class grants and
 * the chosen ability scores on top (see `creation/grants.js`).
 *
 * Keep this in sync with the D&D sheet blocks (`settings/dnd/blocks.json`): the
 * keys here are block ids under `values`.
 */

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

const PRESET = {
  lvl: { level: 1, exp: 0 },
  speed: 30,
  hp: { max: 10, current: 10, diceCount: 1 },
  armor: { ac: 10, shield: false, bonuses: [], shield_bonus: 2 },
  initiative: { base: 0, bonuses: [], use_dex: true },
  STR: { value: 10 },
  DEX: { value: 10 },
  CON: { value: 10 },
  INT: { value: 10 },
  WIS: { value: 10 },
  CHA: { value: 10 },
  prof_bonus: { v: 2, auto: true },
  money: [
    { id: 'gp', title: 'Золотая', short_title: 'зм.', color: '#FFD700', amount: 0 },
    { id: 'sp', title: 'Серебряная', short_title: 'см.', color: '#C0C0C0', amount: 0 },
    { id: 'cp', title: 'Медная', short_title: 'мм.', color: '#B87333', amount: 0 },
  ],
}

/** The blank `values` payload only (no wrapper). */
export function blankValues() {
  return clone(PRESET)
}
