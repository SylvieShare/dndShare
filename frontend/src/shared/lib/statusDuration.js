export const STATUS_DURATION_OPTIONS = [
  { value: 'manual', label: 'До ручного снятия' },
  { value: 'rounds', label: 'Раунды' },
  { value: 'minutes', label: 'Минуты' },
  { value: 'hours', label: 'Часы' },
  { value: 'days', label: 'Дни' },
  { value: 'until_rest', label: 'До отдыха' },
  { value: 'permanent', label: 'Постоянно' },
  { value: 'custom', label: 'Особое условие' },
]

const UNITS = {
  rounds: ['раунд', 'раунда', 'раундов', 'р.'],
  minutes: ['минута', 'минуты', 'минут', 'мин.'],
  hours: ['час', 'часа', 'часов', 'ч.'],
  days: ['день', 'дня', 'дней', 'д.'],
}

export function isTimedStatusDuration(kind) { return Object.hasOwn(UNITS, kind) }

export function statusDurationError(duration) {
  if (!STATUS_DURATION_OPTIONS.some(option => option.value === duration?.kind)) return 'Выберите длительность.'
  if (isTimedStatusDuration(duration.kind)) {
    const value = Number(duration.value)
    if (!Number.isSafeInteger(value) || value <= 0) return 'Укажите целое число больше нуля.'
  }
  if (duration.kind === 'custom' && !String(duration.text || '').trim()) return 'Укажите, когда заканчивается эффект.'
  if (duration.kind === 'custom' && String(duration.text).trim().length > 200) return 'Условие должно быть не длиннее 200 символов.'
  return ''
}

export function copyStatusDuration(duration = { kind: 'manual' }) {
  return { kind: 'manual', ...duration }
}

export function cleanStatusDuration(duration) {
  if (isTimedStatusDuration(duration.kind)) return { kind: duration.kind, value: Number(duration.value) }
  if (duration.kind === 'custom') return { kind: 'custom', text: String(duration.text || '').trim() }
  return { kind: duration.kind }
}

export function statusDuration(duration = {}, { compact = false } = {}) {
  const kind = duration?.kind || 'manual'
  if (kind === 'manual') return compact ? 'До снятия' : 'До ручного снятия'
  if (kind === 'until_rest') return 'До отдыха'
  if (kind === 'permanent') return 'Постоянно'
  if (kind === 'custom') return String(duration.text || '').trim() || 'Не указана'
  const value = Number(duration?.value)
  const unit = UNITS[kind]
  if (!unit || !Number.isFinite(value) || value <= 0) return 'Не указана'
  if (compact) return `${value} ${unit[3]}`
  const mod100 = value % 100, mod10 = value % 10
  const index = mod100 >= 11 && mod100 <= 14 ? 2 : mod10 === 1 ? 0 : mod10 >= 2 && mod10 <= 4 ? 1 : 2
  return `${value} ${unit[index]}`
}
