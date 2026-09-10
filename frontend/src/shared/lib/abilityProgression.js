/** One calculation shared by the editor preview, sheet, widgets and weapon rolls. */
export function weaponDamageDiceCount(rule, level) {
  const divisor = Math.max(0, Number(rule?.dice_count_level_divisor) || 0)
  if (!divisor) return Math.max(0, Number(rule?.dice_count) || 0)
  const scaled = Math.max(0, Number(level) || 0) / divisor
  return rule.dice_count_rounding === 'down' ? Math.floor(scaled) : Math.ceil(scaled)
}

export function weaponDamageLabel(rule, level) {
  if (level < Math.max(1, Number(rule?.level) || 1)) return ''
  const count = weaponDamageDiceCount(rule, level)
  return count > 0 && rule?.dice ? `${count}${String(rule.dice).replace(/^d/i, 'к')}` : ''
}

export function currentProgression(rows, level) {
  return (rows || []).filter(row => Number(row.level || 1) <= level)
    .sort((a, b) => Number(b.level || 1) - Number(a.level || 1))[0]
}

export function automaticAbilityLabel(data, level) {
  const damage = (data?.weapon_damage || []).map(rule => weaponDamageLabel(rule, level)).filter(Boolean)
  return damage.length ? damage.join(' + ') : String(currentProgression(data?.scaling, level)?.value || '')
}

export function progressionError(data) {
  for (const key of ['scaling', 'display_scaling']) {
    const levels = new Set()
    for (const row of data[key] || []) {
      if (!Number.isInteger(Number(row.level)) || row.level < 1 || row.level > 20) return 'Развитие с уровнем: укажите уровень от 1 до 20.'
      if (levels.has(Number(row.level))) return 'Развитие с уровнем: два изменения одного вида не могут начинаться с одинакового уровня.'
      levels.add(Number(row.level))
      if (row.uses != null && (!Number.isInteger(Number(row.uses)) || Number(row.uses) < 0)) return 'Число использований должно быть целым и неотрицательным.'
    }
  }
  return ''
}
