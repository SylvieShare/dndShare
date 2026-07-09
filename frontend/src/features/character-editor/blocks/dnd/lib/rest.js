// Pure rest transforms for DND_REST. No Pinia / no Vue — the block injects raw block values
// and writes the returned objects back via update:value(<id>, ...).

import { abilityModifier, resolveNumValue } from '@/shared/lib/dnd'

// Ability modifier from a stat value (same shape DND_CHAR_STAT_10 stores: `{ value: { base, bonuses } }`,
// or a legacy plain number). Used for the hit-die heal (1dX + CON mod). Absent value defaults to 10.
export function statMod(statVal) {
  const v = statVal && typeof statVal === 'object' ? statVal.value : statVal
  return abilityModifier(v == null ? 10 : resolveNumValue(v))
}

// Hit dice regained on a long rest: half the total (round down), minimum 1.
export function recoveredHitDice(diceCount) {
  return Math.max(1, Math.floor((Number(diceCount) || 1) / 2))
}

// Long rest: full HP, drop temp + death saves, regain half the spent hit dice.
export function longRestHp(hp) {
  const h = { ...(hp || {}) }
  const max = Number(h.max) || 0
  const diceCount = Number(h.diceCount) || 1
  const diceUsed = Number(h.diceUsed) || 0
  h.current = max
  h.temp = 0
  h.diceUsed = Math.max(0, diceUsed - recoveredHitDice(diceCount))
  h.ds_success = 0
  h.ds_failure = 0
  return h
}

// Long rest: every spell-slot level back to 0 used. A long rest always recovers slots,
// regardless of the configured recovery rest (short-rest casters recharge on a long rest too).
export function longRestSpells(spells) {
  if (!spells || typeof spells !== 'object') return spells
  if (!Array.isArray(spells.slots)) return spells
  return { ...spells, slots: spells.slots.map(s => ({ ...s, used: 0 })) }
}

// Short rest: recover spell slots only when the block is configured to recharge on a short rest
// (e.g. warlock pact magic, `slots_rest === 'short_rest'`); otherwise leave them untouched.
export function shortRestSpells(spells) {
  if (!spells || typeof spells !== 'object') return spells
  if (spells.slots_rest !== 'short_rest') return spells
  if (!Array.isArray(spells.slots)) return spells
  return { ...spells, slots: spells.slots.map(s => ({ ...s, used: 0 })) }
}

// Restore resource charges to full. `kind` 'short' restores resources flagged `short_rest`;
// 'long' restores anything flagged `short_rest` OR `long_rest` (short-rest recharge also recharges on a long rest).
// A resource's `value` is its current available charges out of `total`, so a full recharge is `value = total`.
export function restResources(resources, kind) {
  if (!Array.isArray(resources)) return resources
  return resources.map(r => {
    const restores = kind === 'long' ? (r.short_rest || r.long_rest) : r.short_rest
    return restores ? { ...r, value: Math.max(0, Number(r.total) || 0) } : r
  })
}

// Long rest: reduce exhaustion by one level. Tolerates the legacy plain-number shape.
export function longRestExhaustion(ex) {
  if (ex && typeof ex === 'object') {
    return { ...ex, level: Math.max(0, (Number(ex.level) || 0) - 1) }
  }
  return Math.max(0, (Number(ex) || 0) - 1)
}

// Current exhaustion level for either shape (used to decide whether there's anything to reduce).
export function exhaustionLevel(ex) {
  if (ex && typeof ex === 'object') return Number(ex.level) || 0
  return Number(ex) || 0
}

// Apply one spent hit die: heal by `amount` (rolled elsewhere), clamp to max, mark one die used.
export function spendHitDie(hp, amount) {
  const h = { ...(hp || {}) }
  const max = Number(h.max) || 0
  const current = Number(h.current) || 0
  const diceCount = Number(h.diceCount) || 1
  const diceUsed = Number(h.diceUsed) || 0
  h.current = Math.min(max, current + Math.max(0, amount))
  h.diceUsed = Math.min(diceCount, diceUsed + 1)
  return h
}
