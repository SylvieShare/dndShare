// Pure rest transforms for DND_REST. No Pinia / no Vue — the block injects raw block values
// and writes the returned objects back via update:value(<id>, ...).

import { abilityModifier, resolveNumValue } from '@/shared/lib/dnd'
import {
  hitDiceTotal,
  hitDiceUsed,
  normalizeHitDie,
  normalizeHitDice,
  withHitDice,
} from '@/features/character-editor/blocks/dnd/lib/hitDice'
import { hpMaximum } from '@/features/character-editor/blocks/dnd/lib/hp'

// Ability modifier from the DND_CHAR_STAT_10 shape: `{ value: { base, bonuses } }`.
export function statMod(statVal) {
  return abilityModifier(resolveNumValue(statVal?.value))
}

// Hit dice regained on a long rest: half the total (round down), minimum 1.
export function recoveredHitDice(diceCount) {
  return Math.max(1, Math.floor((Number(diceCount) || 1) / 2))
}

export function longRestRecoveryCount(hp) {
  const pools = normalizeHitDice(hp)
  return Math.min(hitDiceUsed(pools), recoveredHitDice(hitDiceTotal(pools)))
}

function recoveryFor(recovery, die) {
  if (Array.isArray(recovery)) {
    return Number(recovery.find((row) => normalizeHitDie(row?.die) === die)?.count) || 0
  }
  return Number(recovery?.[die]) || 0
}

// Long rest: full HP, drop temp + death saves, regain half the spent hit dice.
export function longRestHp(hp, recovery = null) {
  let h = { ...(hp || {}) }
  const max = hpMaximum(h)
  const pools = normalizeHitDice(h).map((row) => ({ ...row }))
  let left = longRestRecoveryCount(h)
  for (const row of pools) {
    const requested = recovery == null ? left : Math.max(0, Math.floor(recoveryFor(recovery, row.die)))
    const restored = Math.min(row.used, left, requested)
    row.used -= restored
    left -= restored
  }
  h = withHitDice(h, pools)
  h.current = max
  h.temp = 0
  h.ds_success = 0
  h.ds_failure = 0
  return h
}

// Long rest: every spell-slot level back to 0 used. A long rest always recovers slots,
// regardless of the configured recovery rest (short-rest casters recharge on a long rest too).
export function longRestSpells(spells) {
  if (!spells || typeof spells !== 'object') return spells
  if (spells.slot_pools && typeof spells.slot_pools === 'object') {
    const slotPools = {
      long_rest: (spells.slot_pools.long_rest || []).map((slot) => ({ ...slot, used: 0 })),
      short_rest: (spells.slot_pools.short_rest || []).map((slot) => ({ ...slot, used: 0 })),
    }
    return {
      ...spells,
      slot_pools: slotPools,
      ...(Array.isArray(spells.slots) ? { slots: slotPools.long_rest.map((slot) => ({ ...slot })) } : {}),
    }
  }
  return {
    ...spells,
    ...(Array.isArray(spells.slots) ? { slots: spells.slots.map(s => ({ ...s, used: 0 })) } : {}),
    ...(spells.pact_slots ? { pact_slots: { ...spells.pact_slots, used: 0 } } : {}),
  }
}

// Short rest: recover spell slots only when the block is configured to recharge on a short rest
// (e.g. warlock pact magic, `slots_rest === 'short_rest'`); otherwise leave them untouched.
export function shortRestSpells(spells) {
  if (!spells || typeof spells !== 'object') return spells
  if (spells.slot_pools && typeof spells.slot_pools === 'object') {
    return {
      ...spells,
      slot_pools: {
        ...spells.slot_pools,
        short_rest: (spells.slot_pools.short_rest || []).map((slot) => ({ ...slot, used: 0 })),
      },
    }
  }
  const restoreShared = spells.slots_rest === 'short_rest' && Array.isArray(spells.slots)
  if (!restoreShared && !spells.pact_slots) return spells
  return {
    ...spells,
    ...(restoreShared ? { slots: spells.slots.map(s => ({ ...s, used: 0 })) } : {}),
    ...(spells.pact_slots ? { pact_slots: { ...spells.pact_slots, used: 0 } } : {}),
  }
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

export function longRestExhaustion(ex) {
  return { ...(ex || {}), level: Math.max(0, (Number(ex?.level) || 0) - 1) }
}

export function exhaustionLevel(ex) {
  return Number(ex?.level) || 0
}

// Apply one spent hit die: heal by `amount` (rolled elsewhere), clamp to max, mark one die used.
export function spendHitDie(hp, amount, die = null) {
  let h = { ...(hp || {}) }
  const max = hpMaximum(h)
  const current = Number(h.current) || 0
  const pools = normalizeHitDice(h).map((row) => ({ ...row }))
  const selected = die
    ? pools.find((row) => row.die === normalizeHitDie(die) && row.used < row.total)
    : pools.find((row) => row.used < row.total)
  if (!selected) return h
  selected.used += 1
  h = withHitDice(h, pools)
  h.current = Math.min(max, current + Math.max(0, amount))
  return h
}
