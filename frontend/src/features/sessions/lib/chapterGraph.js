import { SESSION_IMAGE_PRESETS, sessionImagePresetUrl, sessionImageUrl } from '@/features/sessions/lib/sessionImages'

export const CHAPTER_STATUSES = [
  { key: 'draft', label: 'Черновик', tone: 'muted' },
  { key: 'planned', label: 'Запланирована', tone: 'info' },
  { key: 'ready', label: 'Подготовлена', tone: 'violet' },
  { key: 'available', label: 'Доступна', tone: 'accent' },
  { key: 'in_progress', label: 'В процессе', tone: 'warning' },
  { key: 'paused', label: 'Приостановлена', tone: 'muted' },
  { key: 'completed', label: 'Завершена', tone: 'success' },
  { key: 'failed', label: 'Провалена', tone: 'danger' },
  { key: 'skipped', label: 'Пропущена', tone: 'muted' },
  { key: 'cancelled', label: 'Отменена', tone: 'danger' },
]

export const CHAPTER_PRESETS = SESSION_IMAGE_PRESETS

export const CHAPTER_NODE_WIDTH = 236
export const CHAPTER_NODE_HEIGHT = 156

export function chapterStatus(key) {
  return CHAPTER_STATUSES.find(item => item.key === key) ?? CHAPTER_STATUSES[1]
}

export function chapterPresetUrl(key) {
  return sessionImagePresetUrl(key)
}

export function chapterImageUrl(chapter) {
  return sessionImageUrl(chapter)
}

export function romanNumeral(value) {
  let number = Number(value)
  if (!Number.isInteger(number) || number <= 0) return String(value ?? '')
  const parts = [
    [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'],
    [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
  ]
  let result = ''
  for (const [amount, glyph] of parts) {
    while (number >= amount) {
      result += glyph
      number -= amount
    }
  }
  return result
}

export function arcLabel(arc) {
  if (!arc) return 'Арка'
  return `Арка ${romanNumeral(arc.order)} · ${arc.name}`
}

export function currentChapterLabel(chapter, compact = false) {
  if (!chapter) return ''
  const number = chapter.number ?? chapter.chapterNumber
  const name = chapter.name ?? chapter.chapterName
  const arc = chapter.arcOrder ? `Арка ${romanNumeral(chapter.arcOrder)}` : ''
  const current = number != null ? `${compact ? 'Гл.' : 'Глава'} ${number}` : ''
  return [arc, current, name].filter(Boolean).join(' · ')
}

export function edgePath(from, to) {
  if (!from || !to) return ''
  const fromCenterX = from.positionX + CHAPTER_NODE_WIDTH / 2
  const fromCenterY = from.positionY + CHAPTER_NODE_HEIGHT / 2
  const toCenterX = to.positionX + CHAPTER_NODE_WIDTH / 2
  const toCenterY = to.positionY + CHAPTER_NODE_HEIGHT / 2
  const direction = toCenterX >= fromCenterX ? 1 : -1
  const startX = fromCenterX + direction * CHAPTER_NODE_WIDTH / 2
  const endX = toCenterX - direction * CHAPTER_NODE_WIDTH / 2
  const bend = Math.max(70, Math.abs(endX - startX) * 0.45)
  return `M ${startX} ${fromCenterY} C ${startX + direction * bend} ${fromCenterY}, ${endX - direction * bend} ${toCenterY}, ${endX} ${toCenterY}`
}

export function edgeMidpoint(from, to) {
  return {
    x: ((from?.positionX ?? 0) + (to?.positionX ?? 0)) / 2 + CHAPTER_NODE_WIDTH / 2,
    y: ((from?.positionY ?? 0) + (to?.positionY ?? 0)) / 2 + CHAPTER_NODE_HEIGHT / 2,
  }
}
