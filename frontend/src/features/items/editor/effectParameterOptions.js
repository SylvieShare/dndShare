const derivedLabels = {
  armor_bonus: 'Бонус к КД', armor_minimum: 'Минимальный КД', speed_bonus: 'Бонус скорости',
  check_bonus: 'Бонус проверки', skill_bonus: 'Бонус навыка', save_bonus: 'Бонус спасброска',
  weapon_attack_bonus: 'Бонус к атаке', weapon_damage_bonus: 'Бонус к урону',
  speed_multiplier: 'Множитель скорости', ability_minimum: 'Минимальное значение характеристики',
}

export function effectParameterOptions(effect, bindings = []) {
  const options = new Map()
  function add(key, label) {
    if (typeof key !== 'string' || !key) return
    const labels = options.get(key) || []
    if (!labels.includes(label)) labels.push(label)
    options.set(key, labels)
  }
  function visit(value) {
    if (!value || typeof value !== 'object') return
    add(value.value_parameter, value.label || derivedLabels[value.kind] || 'Значение эффекта')
    add(value.dice_count_parameter, value.label ? `Число костей урона · ${value.label}` : 'Число костей урона')
    Object.values(value).forEach(visit)
  }
  visit(effect?.data)
  for (const binding of bindings) if (binding.key && !options.has(binding.key)) add(binding.key, binding.key)
  return [...options].map(([key, labels]) => ({ key, label: labels.join(' / ') }))
}

export function setEffectParameter(data, key, source, changes = {}) {
  const rows = data.parameter_bindings || []
  if (!source) {
    data.parameter_bindings = rows.filter(row => row.key !== key)
    return
  }
  const previous = rows.find(row => row.key === key)
  const next = { ...previous, ...changes, key, source }
  if (source === 'fixed') next.value ??= 0
  for (const field of ['value', 'step', 'multiplier', 'minimum', 'maximum']) {
    if (source === 'scaling_value' || source === 'fixed' && field !== 'value' || next[field] == null || next[field] === '') delete next[field]
  }
  data.parameter_bindings = previous ? rows.map(row => row === previous ? next : row) : [...rows, next]
}
