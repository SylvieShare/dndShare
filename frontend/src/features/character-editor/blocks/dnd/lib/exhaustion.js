import { dndRules } from '@/shared/lib/dndRules'
export const DEFAULT_EXHAUSTION_EFFECTS = dndRules('2014').exhaustionDescriptions

export function normalizeExhaustion(value, version = '2014') {
  const data = value && typeof value === 'object' ? value : { level: 0 }
  const rawMax = parseInt(data.max)
  const max = rawMax > 0 ? Math.min(20, rawMax) : 6
  const defaults = dndRules(version).exhaustionDescriptions
  const configuredEffects = Array.isArray(data.effects) ? data.effects : []
  const effects = Array.from({ length: max }, (_, index) =>
    configuredEffects[index] != null && configuredEffects[index] !== ''
      ? configuredEffects[index]
      : (defaults[index] || `Уровень ${index + 1}`)
  )
  const level = Math.max(0, Math.min(max, parseInt(data.level) || 0))

  return { data, max, effects, level }
}
