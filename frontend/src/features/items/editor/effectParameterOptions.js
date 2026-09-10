export function effectParameterOptions(effect, bindings = []) {
  const options = new Map()
  function visit(value) {
    if (!value || typeof value !== 'object') return
    if (typeof value.value_parameter === 'string' && value.value_parameter) {
      options.set(value.value_parameter, { key: value.value_parameter, label: value.label || 'Значение эффекта' })
    }
    Object.values(value).forEach(visit)
  }
  visit(effect?.data)
  for (const binding of bindings) if (binding.key && !options.has(binding.key)) options.set(binding.key, { key: binding.key, label: binding.key })
  return [...options.values()]
}

export function setEffectParameter(data, key, source, value) {
  const rest = (data.parameter_bindings || []).filter(row => row.key !== key)
  data.parameter_bindings = source ? [...rest, { key, source, ...(source === 'fixed' ? { value: value ?? 0 } : {}) }] : rest
}
