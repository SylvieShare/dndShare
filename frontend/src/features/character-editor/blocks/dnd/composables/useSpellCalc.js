import { spellScalingSteps } from '../lib/spellScaling'
export { spellDurationLabel } from '@/shared/lib/spellPresentation'


export function useSpellCalc({ diceMap, diceDetailsMap, damageTypeMap, damageTypeColorMap, schoolMap, spellModifiers }) {
  function schoolMeta(item) {
    const id = item?.data?.schoolId
    if (id == null) return null
    return schoolMap.value[id] || schoolMap.value[String(id)] || null
  }

  const spellRangeOverride = item => spellModifiers?.value?.find(rule => rule.spellId === String(item?.id) && rule.range)?.range || ''

  function dicePart(row) {
    const count = Number(row?.count) || 1
    const diceId = row?.dice_id
    const dice = diceDetailsMap.value[diceId] || null
    const diceLabel = dice?.value || diceMap.value[diceId] || ''
    const typeId = row?.type
    return {
      count,
      diceLabel,
      diceSides: dice?.sides || null,
      label: diceLabel ? `${count}${diceLabel}` : '',
      type: damageTypeMap.value[typeId] || typeId || '',
      typeColor: damageTypeColorMap?.value?.[typeId] || '',
      bonus: Number(row?.bonus) || 0,
    }
  }

  // База + addon×steps: addon-строка прибавляет count к совпадающей по кубику/типу базовой, иначе добавляется отдельно.
  function mergeRows(base, addon, steps) {
    const out = (Array.isArray(base) ? base : []).map(r => ({ ...r }))
    if (steps > 0 && Array.isArray(addon)) {
      for (const a of addon) {
        const match = out.find(r => r.dice_id === a.dice_id && (r.type ?? null) === (a.type ?? null))
        if (match) {
          match.count = (Number(match.count) || 0) + (Number(a.count) || 0) * steps
          match.bonus = (Number(match.bonus) || 0) + (Number(a.bonus) || 0) * steps
        } else out.push({ ...a, count: (Number(a.count) || 0) * steps, bonus: (Number(a.bonus) || 0) * steps })
      }
    }
    return out
  }

  function damageDiceParts(item, castLevel, charLevel, abilityModifier = 0) {
    const dmg = item?.data?.damage || {}
    const steps = spellScalingSteps(dmg, item?.data?.lvl, castLevel, charLevel)
    const bonus = (spellModifiers?.value || []).filter(rule => rule.spellId === String(item?.id))
      .reduce((sum, rule) => sum + rule.damageBonus, 0)
    return mergeRows(dmg.dices, dmg.addon, steps).map(dicePart)
      .map((part, index) => index === 0 ? { ...part, bonus: part.bonus + bonus + (dmg.add_mod ? abilityModifier : 0) } : part)
      .filter(part => part.label || part.diceSides || part.bonus)
  }

  function healDiceParts(item, castLevel, charLevel, abilityModifier = 0) {
    const heal = item?.data?.heal || {}
    const steps = spellScalingSteps(heal, item?.data?.lvl, castLevel, charLevel)
    return mergeRows(heal.dices, heal.addon, steps).map(dicePart)
      .map((part, index) => index === 0 ? { ...part, bonus: part.bonus + (heal.add_mod ? abilityModifier : 0) } : part)
      .filter(part => part.label || part.diceSides || part.bonus)
  }

  function hasSpellMetrics(item) {
    return !!(item?.data?.damage?.range_attack || damageDiceParts(item).length || healDiceParts(item).length)
  }

  return {
    schoolMeta,
    spellRangeOverride,
    dicePart,
    damageDiceParts,
    healDiceParts,
    hasSpellMetrics,
  }
}
