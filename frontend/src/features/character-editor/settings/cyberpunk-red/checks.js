// Pure resolution. Dice are supplied by the caller; this module never rolls,
// spends a resource, or submits a session event.
function integer(value, name, min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER) {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new RangeError(`${name}: expected an integer from ${min} to ${max}`)
  }
  return value
}

export function resolveRedSkillCheck({ stat, skill, modifiers = 0, luck = 0, availableLuck,
  die, extraDie = null, dv = null }) {
  integer(stat, 'stat', 0)
  integer(skill, 'skill', 0, 10)
  integer(modifiers, 'modifiers')
  integer(luck, 'luck', 0)
  integer(availableLuck, 'availableLuck', 0)
  if (luck > availableLuck) throw new RangeError('Insufficient LUCK')
  integer(die, 'die', 1, 10)
  const critical = die === 1 ? 'failure' : die === 10 ? 'success' : null
  if (critical) integer(extraDie, 'extraDie', 1, 10)
  else if (extraDie !== null) throw new RangeError('Unexpected extra die')
  if (dv !== null) integer(dv, 'dv')
  // A second 1/10 does not generate another die; neither implies automatic failure/success.
  const extra = critical === 'failure' ? -extraDie : critical === 'success' ? extraDie : 0
  const total = stat + skill + modifiers + luck + die + extra
  integer(total, 'total')
  return {
    total, dice: extraDie === null ? [die] : [die, extraDie], critical,
    breakdown: { stat, skill, modifiers, luck, die, extra },
    success: dv === null ? null : total > dv,
    luckCost: luck,
  }
}

export function resolveRedOpposedCheck(attacker, defender) {
  integer(attacker, 'attacker')
  integer(defender, 'defender')
  return { winner: attacker > defender ? 'attacker' : 'defender', margin: attacker - defender }
}

export function resolveRedInitiative({ reflexes, modifier = 0, die }) {
  integer(reflexes, 'reflexes', 0)
  integer(modifier, 'modifier')
  integer(die, 'die', 1, 10)
  const total = reflexes + modifier + die
  integer(total, 'total')
  return { total, reflexes, modifier, die }
}

// Standard body-hit preview only. Shields, cover, headshots, special ammunition,
// environmental damage and net damage require their own explicit resolvers.
export function previewRedBodyHit({ damageDice, sp, armorMode = 'full', criticalEligible = true }) {
  if (!Array.isArray(damageDice) || damageDice.length === 0 || damageDice.length > 100) {
    throw new RangeError('damageDice: expected 1–100 d6 results')
  }
  damageDice.forEach(die => integer(die, 'damage die', 1, 6))
  integer(sp, 'sp', 0)
  if (!['full', 'half'].includes(armorMode)) throw new RangeError('Unsupported armor mode')
  if (typeof criticalEligible !== 'boolean') throw new TypeError('criticalEligible must be boolean')
  const rawDamage = damageDice.reduce((sum, die) => sum + die, 0)
  const effectiveSp = armorMode === 'half' ? Math.ceil(sp / 2) : sp
  const penetratingDamage = Math.max(0, rawDamage - effectiveSp)
  const criticalInjury = criticalEligible && damageDice.filter(die => die === 6).length >= 2
  const criticalBonus = criticalInjury ? 5 : 0
  // Critical bonus bypasses armor but does not by itself cause ablation.
  const spLoss = penetratingDamage > 0 && sp > 0 ? 1 : 0
  return { rawDamage, effectiveSp, penetratingDamage, criticalInjury, criticalBonus,
    hpLoss: penetratingDamage + criticalBonus, spLoss, spAfter: sp - spLoss }
}
