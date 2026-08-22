import { formatBonus } from '@/shared/lib/dnd'
import { normalizeAddAttacks } from '@/features/character-editor/blocks/dnd/lib/weaponEntry'
import { weaponAbilityModifier } from '@/features/character-editor/blocks/dnd/lib/weaponAbility'

export function useWeaponCalc({
  statsVar,
  profBonus,
  diceMap,
  diceDetailsMap,
  damageTypeMap,
  damageTypeDetailsMap,
  item,
  propertyItems,
  itemBaseAttacks,
  itemTwoHandedAttacks,
  isProficient = (entry) => !!entry.proficient,
}) {
  function statMod(entry) {
    return weaponAbilityModifier(entry, item(entry), propertyItems(entry), statsVar.value)
  }

  function magicBonus(entry) {
    return Number(entry.params?.magic_bonus) || 0
  }

  function attackBonus(entry) {
    return statMod(entry) + magicBonus(entry) + (isProficient(entry) ? profBonus.value : 0)
  }

  function damageBonus(entry) {
    return statMod(entry) + magicBonus(entry)
  }

  function attackDisplay(attack) {
    const count = Number(attack.count) || 1
    const diceId = attack.dice_id
    const dice = diceDetailsMap.value[diceId] || null
    const diceLabel = dice?.value || diceMap.value[diceId] || ''
    const typeId = attack.type
    const typeDetails = damageTypeDetailsMap.value[typeId] || null
    const type = typeDetails?.value || damageTypeMap.value[typeId] || typeId || ''
    const typeColor = typeDetails?.color || ''
    return {
      count,
      diceLabel,
      diceSides: dice?.sides || null,
      label: diceLabel ? `${count}${diceLabel}` : String(count),
      type,
      typeColor,
    }
  }

  function customAttackDisplay(attack) {
    return attackDisplay({
      count: attack.count,
      dice_id: attack.dice_id,
      type: attack.type_suggest_id,
    })
  }

  function formatLabel(type, color) {
    if (!type) return ''
    return color ? `{${type}|${color}}` : `{${type}}`
  }

  function buildDamageExpr(attacks, entry) {
    const segments = []
    let firstType = ''
    let firstColor = ''
    const customAttacks = normalizeAddAttacks(entry.add_attacks).map(attack => ({
      count: attack.count,
      dice_id: attack.dice_id,
      type: attack.type_suggest_id,
    }))
    const allAttacks = [...attacks, ...customAttacks]
    for (const a of allAttacks) {
      const ad = attackDisplay(a)
      if (!ad.diceLabel) continue
      if (!firstType) { firstType = ad.type; firstColor = ad.typeColor }
      segments.push(`+${ad.count}${ad.diceLabel}${formatLabel(ad.type, ad.typeColor)}`)
    }
    const bonus = damageBonus(entry)
    if (bonus) {
      const sign = bonus >= 0 ? '+' : ''
      segments.push(`${sign}${bonus}${formatLabel(firstType, firstColor)}`)
    }
    return segments.join('').replace(/^\+/, '') || '0'
  }

  function damageExpression(entry) {
    return buildDamageExpr(itemBaseAttacks(entry), entry)
  }

  function damageExpressionTwoHanded(entry) {
    return buildDamageExpr(itemTwoHandedAttacks ? itemTwoHandedAttacks(entry) : [], entry)
  }

  function buildCriticalDamageExpr(attacks, entry, extraWeaponDice = 0) {
    const doubled = (attacks || []).map((attack, index) => ({
      ...attack,
      count: (Number(attack.count) || 1) * 2 + (index === 0 ? Math.max(0, Number(extraWeaponDice) || 0) : 0),
    }))
    const doubledExtra = normalizeAddAttacks(entry.add_attacks).map((attack) => ({
      count: (Number(attack.count) || 1) * 2,
      dice_id: attack.dice_id,
      type_suggest_id: attack.type_suggest_id,
    }))
    return buildDamageExpr(doubled, { ...entry, add_attacks: doubledExtra })
  }

  function criticalDamageExpression(entry, extraWeaponDice = 0) {
    return buildCriticalDamageExpr(itemBaseAttacks(entry), entry, extraWeaponDice)
  }

  function criticalDamageExpressionTwoHanded(entry, extraWeaponDice = 0) {
    return buildCriticalDamageExpr(itemTwoHandedAttacks ? itemTwoHandedAttacks(entry) : [], entry, extraWeaponDice)
  }

  // Table presentation keeps the flat modifier on the first damage part.
  function damageParts(entry) {
    const parts = itemBaseAttacks(entry).map(attackDisplay)
    const bonus = damageBonus(entry)
    if (parts.length && bonus) parts[0] = { ...parts[0], modifier: bonus }
    else if (!parts.length && bonus) parts.push({ label: formatBonus(bonus), type: '', diceSides: null })
    return [
      ...parts,
      ...normalizeAddAttacks(entry.add_attacks).map(customAttackDisplay),
    ].filter(part => part.label || part.diceSides)
  }

  // Raw dice parts (no flat modifier merged in) for the shared AttackDamage component — the flat
  // modifier is passed alongside via `damageBonus`.
  function damagePartsRaw(entry) {
    return [
      ...itemBaseAttacks(entry).map(attackDisplay),
      ...normalizeAddAttacks(entry.add_attacks).map(customAttackDisplay),
    ].filter(part => part.label || part.diceSides)
  }

  function twoHandedParts(entry) {
    const two = itemTwoHandedAttacks ? itemTwoHandedAttacks(entry) : []
    if (!two.length) return []
    return [
      ...two.map(attackDisplay),
      ...normalizeAddAttacks(entry.add_attacks).map(customAttackDisplay),
    ].filter(part => part.label || part.diceSides)
  }

  return {
    statMod,
    magicBonus,
    attackBonus,
    damageBonus,
    formatBonus,
    attackDisplay,
    formatLabel,
    damageExpression,
    damageExpressionTwoHanded,
    criticalDamageExpression,
    criticalDamageExpressionTwoHanded,
    damageParts,
    damagePartsRaw,
    twoHandedParts,
  }
}
