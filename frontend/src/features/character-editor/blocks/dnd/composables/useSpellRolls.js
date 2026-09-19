import { spellSequence } from '../lib/spellSequence'
import { itemEventData } from '@/features/character-editor/lib/sessionEventData'
import { resolveRollMode } from '../lib/rollMode'
import { useSessionEventsStore } from '@/stores/sessionEvents'
import { useDiceStore } from '@/stores/dice'
import { resolveSpellSaveDC } from '@/shared/lib/spellSaveDC'

export function useSpellRolls({ charCtx, spellDamageTypes, spellcastingBlocked, spellAttackBonus, spellSaveDC = () => 10, spellCastingAbility, spellAbilityModifier = () => 0, charLevel, damageDiceParts, healDiceParts }) {
  const dice = useDiceStore()
  const damageEntry = entry => spellDamageTypes ? spellDamageTypes.resolve(entry) : entry
  const typeEvent = entry => entry.damageType ? { damageType: entry.damageType } : {}

  function savingThrow(entry) {
    const rule = entry?.item?.data?.damage || {}
    const ability = ['str', 'dex', 'con', 'int', 'wis', 'cha'].indexOf(rule.save_ability) + 1
    return ability ? { ability, dc: resolveSpellSaveDC(rule, spellSaveDC(entry)), onSuccess: rule.save_effect, condition: rule.save_condition || '', results: [] } : null
  }
  function spellEventData(entry, explicit = false) {
    const save = explicit || entry?.item?.data?.damage?.save_manual !== true ? savingThrow(entry) : null
    const concentration = charCtx.itemTransfers?.concentration?.state?.current
    return { ...itemEventData(entry.item), ...typeEvent(entry), entryKey: entry.ref?.key, ...(Number(concentration?.spellId) === Number(entry.item.id) ? { castId: concentration.id } : {}), ...(save ? { savingThrow: save } : {}) }
  }
  function requestSpellSave(entry) {
    if (spellcastingBlocked.value || !savingThrow(entry)) return
    return useSessionEventsStore().publish({ type: 'spell_used', action: `Спасбросок: ${spellTitle(entry)}`, data: spellEventData(entry, true) })
  }

  function spellTitle(entry) {
    return entry?.item?.name || 'Заклинание'
  }

  function typeTag(part) {
    if (!part.type) return ''
    return part.typeColor ? `{${part.type}|${part.typeColor}}` : `{${part.type}}`
  }

  function spellAttackMode(entry, manualMode = 'auto') {
    const context = { kind: 'attack', abilitySuggestId: spellCastingAbility(entry), weaponAttack: false }
    return charCtx.characterRolls?.resolve?.(manualMode, context) || resolveRollMode(manualMode)
  }

  function rollSpellAttack(entry, mode = 'auto', excluded = [], castLevel) {
    entry = damageEntry(entry)
    if (!entry || spellcastingBlocked.value) return
    const bonus = spellAttackBonus(entry)
    dice.rollD20(`Атака: ${spellTitle(entry)}`, bonus, spellAttackMode(entry, mode).mode, {
      eventData: { ...itemEventData(entry.item), ...typeEvent(entry), attackRoll: true, castLevel, entryKey: entry.ref?.key },
      resultData: attack => spellSequence(entry.item, attack, {
        attackBonus: bonus, attackBonusFormula: charCtx.characterDerivedEffects?.rollBonus?.({ kind: 'attack' }, excluded) || '',
        damageExpression: spellDamagePreview(entry, castLevel), criticalExpression: spellDamagePreview(entry, castLevel, true), castLevel, charLevel: charLevel.value,
      }),
      crit_mode: true,
      bonus_formula: charCtx.characterDerivedEffects?.rollBonus?.({ kind: 'attack' }, excluded),
      roll_triggers: charCtx.characterCombatEffects?.rollTriggers?.('attack') || [],
    })
    const states = charCtx.characterStatuses?.endOn?.('attack')
    if (charCtx.ownerMode && states) charCtx.updateValues({ states })
  }

  function exprWithBonus(parts, withType) {
    return parts.flatMap(part => {
      const tag = withType ? typeTag(part) : ''
      return [part.diceLabel ? `${part.count || 1}${part.diceLabel}${tag}` : '', part.bonus ? `${part.bonus}${tag}` : ''].filter(Boolean)
    }).join('+').replace(/\+-/g, '-')
  }

  function spellDamagePreview(entry, castLevel, critical = false) {
    entry = damageEntry(entry)
    if (!entry) return ''
    const parts = damageDiceParts(entry.item, castLevel, charLevel.value, spellAbilityModifier(entry))
      .map((part) => critical ? { ...part, count: (Number(part.count) || 1) * 2 } : part)
    return exprWithBonus(parts, true)
  }

  function spellHealPreview(entry, castLevel) {
    return exprWithBonus(healDiceParts(entry.item, castLevel, charLevel.value, spellAbilityModifier(entry)), false)
  }

  function rollSpellDamage(entry, castLevel, critical = false) {
    entry = damageEntry(entry)
    if (!entry || spellcastingBlocked.value) return
    const expr = spellDamagePreview(entry, castLevel, critical)
    if (expr) dice.roll(`${critical ? 'Критический урон' : 'Урон'}: ${spellTitle(entry)}`, expr, { eventData: { ...spellEventData(entry), damageRoll: true, castLevel } })
  }

  function rollSpellHeal(entry, castLevel) {
    if (spellcastingBlocked.value) return
    const expr = spellHealPreview(entry, castLevel)
    if (expr) dice.roll(`Лечение: ${spellTitle(entry)}`, expr, { color: 'var(--success)', eventData: itemEventData(entry.item) })
  }

  function rollSpellEffect(entry, castLevel) {
    if (spellcastingBlocked.value) return
    const expr = spellDamagePreview(entry, castLevel)
    if (expr) dice.roll(spellTitle(entry), expr, { eventData: spellEventData(entry) })
  }

  return { requestSpellSave, rollSpellEffect, spellAttackMode, spellDamagePreview, spellHealPreview, spellTitle, rollSpellAttack, rollSpellDamage, rollSpellHeal }
}
