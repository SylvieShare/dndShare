import { resolveRollMode } from '../lib/rollMode'
import { useDiceStore } from '@/stores/dice'

export function useSpellRolls({ charCtx, spellcastingBlocked, spellAttackBonus, spellCastingAbility, charLevel, damageDiceParts, healDiceParts }) {
  const dice = useDiceStore()

  function spellTitle(entry) {
    return entry?.item?.name || 'Заклинание'
  }

  function typeTag(part) {
    if (!part.type) return ''
    return part.typeColor ? `{${part.type}|${part.typeColor}}` : `{${part.type}}`
  }

  function diceExpr(parts, withType) {
    return parts
      .map(p => `${p.count || 1}${p.diceLabel || p.label || ''}${withType ? typeTag(p) : ''}`)
      .filter(seg => /\d/.test(seg))
      .join('+')
  }

  function spellAttackMode(entry, manualMode = 'auto') {
    const context = { kind: 'attack', abilitySuggestId: spellCastingAbility(entry), weaponAttack: false }
    return charCtx.characterRolls?.resolve?.(manualMode, context) || resolveRollMode(manualMode)
  }

  function rollSpellAttack(entry, mode = 'auto') {
    if (spellcastingBlocked.value) return
    const bonus = spellAttackBonus(entry)
    dice.rollD20(`Атака: ${spellTitle(entry)}`, bonus, spellAttackMode(entry, mode).mode, {
      crit_mode: true,
      roll_triggers: charCtx.characterCombatEffects?.rollTriggers?.('attack') || [],
    })
  }

  function exprWithBonus(parts, withType) {
    let expr = diceExpr(parts, withType)
    const bonus = parts.reduce((s, p) => s + (p.bonus || 0), 0)
    if (bonus) expr += (expr && bonus > 0 ? '+' : '') + bonus
    return expr
  }

  function spellDamagePreview(entry, castLevel, critical = false) {
    const parts = damageDiceParts(entry.item, castLevel, charLevel.value)
      .map((part) => critical ? { ...part, count: (Number(part.count) || 1) * 2 } : part)
    return exprWithBonus(parts, true)
  }

  function spellHealPreview(entry, castLevel) {
    return exprWithBonus(healDiceParts(entry.item, castLevel, charLevel.value), false)
  }

  function rollSpellDamage(entry, castLevel, critical = false) {
    if (spellcastingBlocked.value) return
    const expr = spellDamagePreview(entry, castLevel, critical)
    if (expr) dice.roll(`${critical ? 'Критический урон' : 'Урон'}: ${spellTitle(entry)}`, expr)
  }

  function rollSpellHeal(entry, castLevel) {
    if (spellcastingBlocked.value) return
    const expr = spellHealPreview(entry, castLevel)
    if (expr) dice.roll(`Лечение: ${spellTitle(entry)}`, expr)
  }

  return { spellAttackMode, spellDamagePreview, spellHealPreview, spellTitle, rollSpellAttack, rollSpellDamage, rollSpellHeal }
}
