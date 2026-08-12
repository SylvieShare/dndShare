import { componentsLabel } from '@/features/character-editor/blocks/dnd/lib/spellEntry'

export function spellDurationLabel(duration) {
  return String(duration || '').trim().replace(/^(?:(?:Концентрация|Ритуал)\s*,\s*)+/i, '')
}

export function useSpellCalc({ diceMap, diceDetailsMap, damageTypeMap, damageTypeColorMap, schoolMap }) {
  function schoolMeta(item) {
    const id = item?.data?.schoolId
    if (id == null) return null
    return schoolMap.value[id] || schoolMap.value[String(id)] || null
  }

  function schoolName(id) {
    const s = schoolMap.value[id] || schoolMap.value[String(id)]
    return s?.value || ''
  }

  function schoolBadge(item) {
    return schoolName(item?.data?.schoolId)
  }

  const META_SEG_MAX = 16
  function truncSeg(s) {
    const str = String(s).trim()
    return str.length > META_SEG_MAX ? str.slice(0, META_SEG_MAX - 1).trimEnd() + '…' : str
  }

  function spellMetaLine(item) {
    const data = item?.data || {}
    return [componentsLabel(data.components), data.time, data.range, spellDurationLabel(data.duration)]
      .filter(Boolean).map(truncSeg).join(' · ')
  }

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

  // Сколько раз применить addon: slot — за круг выше базового (castLevel), cantrip — по уровню героя (5/11/17).
  function scalingSteps(scaling, baseLvl, castLevel, charLevel) {
    if (scaling === 'slot') {
      const cast = Number(castLevel) || Number(baseLvl) || 0
      return Math.max(0, cast - (Number(baseLvl) || 0))
    }
    if (scaling === 'cantrip') {
      const lvl = Number(charLevel) || 1
      return lvl >= 17 ? 3 : lvl >= 11 ? 2 : lvl >= 5 ? 1 : 0
    }
    return 0
  }

  // База + addon×steps: addon-строка прибавляет count к совпадающей по кубику/типу базовой, иначе добавляется отдельно.
  function mergeRows(base, addon, steps) {
    const out = (Array.isArray(base) ? base : []).map(r => ({ ...r }))
    if (steps > 0 && Array.isArray(addon)) {
      for (const a of addon) {
        const match = out.find(r => r.dice_id === a.dice_id && (r.type ?? null) === (a.type ?? null))
        if (match) match.count = (Number(match.count) || 0) + (Number(a.count) || 0) * steps
        else out.push({ ...a, count: (Number(a.count) || 0) * steps })
      }
    }
    return out
  }

  function damageDiceParts(item, castLevel, charLevel) {
    const dmg = item?.data?.damage || {}
    const steps = scalingSteps(dmg.scaling, item?.data?.lvl, castLevel, charLevel)
    return mergeRows(dmg.dices, dmg.addon, steps).map(dicePart)
      .filter(part => part.label || part.diceSides || part.type)
  }

  function healDiceParts(item, castLevel, charLevel) {
    const heal = item?.data?.heal || {}
    const steps = scalingSteps(heal.scaling, item?.data?.lvl, castLevel, charLevel)
    return mergeRows(heal.dices, heal.addon, steps).map(dicePart)
      .filter(part => part.label || part.diceSides)
  }

  function hasSpellMetrics(item) {
    return !!(item?.data?.damage?.range_attack || damageDiceParts(item).length || healDiceParts(item).length)
  }

  return {
    schoolMeta,
    schoolName,
    schoolBadge,
    spellMetaLine,
    dicePart,
    damageDiceParts,
    healDiceParts,
    hasSpellMetrics,
  }
}
