import { formatBonus } from '@/shared/lib/dnd'
import { normalizeAddAttacks } from '@/features/character-editor/blocks/dnd/lib/weaponEntry'

export function useWeaponCalc({
  statsVar,
  profBonus,
  diceMap,
  diceDetailsMap,
  damageTypeMap,
  damageTypeDetailsMap,
  itemBaseAttacks,
  itemTwoHandedAttacks,
}) {
  function statMod(entry) {
    return Number(statsVar.value?.[String(entry.stat_suggest_id)] ?? 0)
  }

  function magicBonus(entry) {
    return Number(entry.magic_up) || 0
  }

  function attackBonus(entry) {
    return statMod(entry) + magicBonus(entry) + (entry.proficient ? profBonus.value : 0)
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
      iconUrl: dice?.svg || '',
      label: diceLabel ? `${count}${diceLabel}` : String(count),
      type,
      typeColor,
    }
  }

  function customAttackDisplay(attack) {
    return attackDisplay({
      count: attack.count,
      dice_id: attack.dice_suggest_id,
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
      dice_id: attack.dice_suggest_id,
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

  // Table presentation keeps the flat modifier on the first damage part.
  function damageParts(entry) {
    const parts = itemBaseAttacks(entry).map(attackDisplay)
    const bonus = damageBonus(entry)
    if (parts.length && bonus) parts[0] = { ...parts[0], modifier: bonus }
    else if (!parts.length && bonus) parts.push({ label: formatBonus(bonus), type: '', iconUrl: '' })
    return [
      ...parts,
      ...normalizeAddAttacks(entry.add_attacks).map(customAttackDisplay),
    ].filter(part => part.label || part.iconUrl)
  }

  // Raw dice parts (no flat modifier merged in) for the shared AttackDamage component — the flat
  // modifier is passed alongside via `damageBonus`.
  function damagePartsRaw(entry) {
    return [
      ...itemBaseAttacks(entry).map(attackDisplay),
      ...normalizeAddAttacks(entry.add_attacks).map(customAttackDisplay),
    ].filter(part => part.label || part.iconUrl)
  }

  function twoHandedParts(entry) {
    const two = itemTwoHandedAttacks ? itemTwoHandedAttacks(entry) : []
    if (!two.length) return []
    return [
      ...two.map(attackDisplay),
      ...normalizeAddAttacks(entry.add_attacks).map(customAttackDisplay),
    ].filter(part => part.label || part.iconUrl)
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
    damageParts,
    damagePartsRaw,
    twoHandedParts,
  }
}
