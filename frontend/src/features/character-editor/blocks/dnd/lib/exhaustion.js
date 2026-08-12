export const DEFAULT_EXHAUSTION_EFFECTS = [
  'Помеха на проверки характеристик',
  'Скорость уменьшена вдвое',
  'Помеха на броски атаки и спасброски',
  'Максимум хитов уменьшен вдвое',
  'Скорость становится 0',
  'Смерть',
]

export function normalizeExhaustion(value) {
  const data = value && typeof value === 'object' ? value : { level: 0 }
  const rawMax = parseInt(data.max)
  const max = rawMax > 0 ? Math.min(20, rawMax) : 6
  const configuredEffects = Array.isArray(data.effects) ? data.effects : []
  const effects = Array.from({ length: max }, (_, index) =>
    configuredEffects[index] != null && configuredEffects[index] !== ''
      ? configuredEffects[index]
      : (DEFAULT_EXHAUSTION_EFFECTS[index] || `Уровень ${index + 1}`)
  )
  const level = Math.max(0, Math.min(max, parseInt(data.level) || 0))

  return { data, max, effects, level }
}
