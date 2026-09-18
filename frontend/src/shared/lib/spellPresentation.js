export const ACTION_TYPES = [
  { value: 'action', label: 'Действие', group_label: 'Действия' },
  { value: 'bonus_action', label: 'Бонусное действие', group_label: 'Бонусные действия' },
  { value: 'reaction', label: 'Реакция', group_label: 'Реакции' },
  { value: 'free', label: 'Свободное действие', group_label: 'Свободные действия' },
  { value: 'special', label: 'Особое действие', group_label: 'Особые действия' },
  { value: 'timed', label: 'Требует времени', group_label: 'Действия с временем' },
]
export const TIME_UNITS = { rounds: 'раунд.', minutes: 'мин.', hours: 'ч.', days: 'дн.' }
export const RANGE_KINDS = { self: 'От себя', touch: 'Касание', ranged: 'Дальнее', sight: 'Видимость', unlimited: 'Без ограничений', custom: 'Своё значение' }
export const AREA_SHAPES = { sphere: 'Сфера', radius: 'Радиус', cone: 'Конус', line: 'Линия', cube: 'Куб', cylinder: 'Цилиндр', hemisphere: 'Полусфера' }
export function timeLabel(time, withCondition = true) {
  if (!time?.kind) return ''
  const main = time.kind === 'custom' ? time.text || '' : TIME_UNITS[time.kind] ? `${time.value ?? '…'} ${TIME_UNITS[time.kind]}` : ACTION_TYPES.find(row => row.value === time.kind)?.label || ''
  return [main, withCondition && time.condition].filter(Boolean).join(' · ')
}
export function rangeLabel(range) {
  if (!range?.kind) return ''
  if (range.kind === 'custom') return range.text || ''
  const unit = (value, count) => value !== 'miles' ? 'фт.' : count % 10 === 1 && count % 100 !== 11 ? 'миля' : count % 10 >= 2 && count % 10 <= 4 && !(count % 100 >= 12 && count % 100 <= 14) ? 'мили' : 'миль'
  const main = range.kind === 'ranged' ? `${range.distance ?? '…'} ${unit(range.unit, range.distance)}` : range.kind === 'self' && !range.shape ? 'На себя' : RANGE_KINDS[range.kind]
  const area = AREA_SHAPES[range.shape] ? `${AREA_SHAPES[range.shape]} ${range.size ?? '…'} ${unit(range.area_unit, range.size)}` : ''
  return [main, area].filter(Boolean).join(' · ')
}
export function spellDurationLabel(duration) {
  return String(duration || '').trim().replace(/^(?:(?:Концентрация|Ритуал)\s*,\s*)+/i, '')
}
export function timeError(time) {
  if (!time?.kind) return ''
  if (TIME_UNITS[time.kind] && !(Number.isInteger(Number(time.value)) && Number(time.value) > 0)) return 'Укажите положительное целое время.'
  if (time.kind === 'custom' && !time.text?.trim()) return 'Укажите своё значение времени.'
  return ''
}
