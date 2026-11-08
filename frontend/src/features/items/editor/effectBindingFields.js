export const calculatedEffectSources = ['slot_increase', 'cast_level', 'casting_modifier']

const sourceNames = {
  fixed: 'Постоянное число',
  scaling_value: 'Текущее значение прогрессии',
  slot_increase: 'Кругов выше базового',
  cast_level: 'Круг потраченной ячейки',
  casting_modifier: 'Модификатор заклинателя',
}

export function effectBindingSources(fields, allowScaling) {
  return (fields.find(field => field.key === 'source')?.options || [])
    .filter(option => sourceNames[option.value] && (allowScaling || option.value !== 'scaling_value'))
    .map(option => ({ ...option, label: sourceNames[option.value] }))
}

export function effectBindingFields(source) {
  const value = { key: 'value', type: 'int', name: 'Значение', placeholder: '0' }
  if (source === 'fixed') return [value]
  if (!calculatedEffectSources.includes(source)) return []
  return [
    { ...value, name: 'Начальное значение', hint: 'Прибавляется к результату вычисления.' },
    { key: 'step', type: 'int', name: 'Размер шага', min: 1, placeholder: '1', hint: 'Значение источника делится на этот шаг с округлением вниз.' },
    { key: 'multiplier', type: 'int', name: 'Прибавка за шаг', placeholder: '1', hint: 'Каждый полный шаг даёт эту прибавку. Можно указать отрицательное число.' },
    { key: 'minimum', type: 'int', name: 'Минимум результата', placeholder: 'Без ограничения' },
    { key: 'maximum', type: 'int', name: 'Максимум результата', placeholder: 'Без ограничения' },
  ]
}

export function effectBindingError(binding, sources) {
  if (!binding) return ''
  if (!sources.some(option => option.value === binding.source)) return 'Выберите доступный источник значения.'
  for (const field of effectBindingFields(binding.source)) {
    const value = binding[field.key]
    if (value != null && (!Number.isInteger(value) || field.min != null && value < field.min)) {
      return field.min != null ? `В поле «${field.name}» укажите целое число от ${field.min}.` : `В поле «${field.name}» укажите целое число.`
    }
  }
  if (binding.minimum != null && binding.maximum != null && binding.minimum > binding.maximum) return 'Минимум результата должен быть не больше максимума.'
  return ''
}
