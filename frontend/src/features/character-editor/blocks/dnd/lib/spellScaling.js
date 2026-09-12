export function spellScalingSteps(rule, baseLevel, castLevel, charLevel) {
  if (rule?.scaling === 'slot') {
    const cast = Number(castLevel) || Number(baseLevel) || 0
    if (rule.scaling_levels?.length) return rule.scaling_levels.filter(row => cast >= Number(row.level)).length
    const steps = Math.floor(Math.max(0, cast - (Number(baseLevel) || 0)) / Math.max(1, Number(rule.scaling_step) || 1))
    return rule.scaling_max_steps == null ? steps : Math.min(steps, Math.max(0, Number(rule.scaling_max_steps) || 0))
  }
  if (rule?.scaling === 'cantrip') {
    const level = Number(charLevel) || 1
    return level >= 17 ? 3 : level >= 11 ? 2 : level >= 5 ? 1 : 0
  }
  return 0
}

export function spellInstances(item, castLevel, charLevel) {
  const rule = item?.data?.damage || {}
  return Math.max(1, (Number(rule.instances) || 1)
    + (Number(rule.addon_instances) || 0) * spellScalingSteps(rule, item?.data?.lvl, castLevel, charLevel))
}

export function spellScalingHint(item) {
  const data = item?.data || {}
  return [data.damage, data.heal, ...(data.rolls || [])].flatMap(rule => {
    if (!rule || !['slot', 'cantrip'].includes(rule.scaling)) return []
    const terms = (rule.addon || []).flatMap(row => [
      row.dice_id && Number(row.count) > 0 ? `${Number(row.count)}${String(row.dice_id).replace('d', 'к')}` : '',
      Number(row.bonus) ? String(Number(row.bonus)) : '',
    ].filter(Boolean))
    const growth = [terms.length ? `+${terms.join(' + ')}` : '',
      Number(rule.addon_instances) > 0 ? `+${rule.addon_instances} снаряд/луч` : '',
    ].filter(Boolean).join('; ')
    if (!growth) return []
    if (rule.scaling === 'slot' && rule.scaling_levels?.length) return [`${rule.label ? rule.label + ': ' : ''}${growth} на кругах ячейки ${rule.scaling_levels.map(row => row.level).join(', ')}`]
    const step = Math.max(1, Number(rule.scaling_step) || 1)
    const prefix = rule.label ? rule.label + ': ' : ''
    return [prefix + (rule.scaling === 'cantrip'
      ? `${growth} на уровнях героя 5, 11 и 17`
      : `${growth} за ${step === 1 ? 'каждый круг' : `каждые ${step} круга`} ячейки выше ${Number(data.lvl)}-го${rule.scaling_max_steps == null ? '' : ` (не более ${rule.scaling_max_steps} прибавок)`}`)]
  }).join(' · ')
}
