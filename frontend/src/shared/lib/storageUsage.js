const BYTE_UNITS = ['Б', 'КБ', 'МБ', 'ГБ', 'ТБ']

export function hasKnownFileSize(value) {
  return value !== null && value !== undefined && Number.isFinite(Number(value)) && Number(value) >= 0
}

export function formatBytes(value) {
  if (!hasKnownFileSize(value)) return 'Размер неизвестен'
  const bytes = Number(value)
  if (bytes === 0) return '0 Б'
  const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), BYTE_UNITS.length - 1)
  const amount = bytes / (1024 ** unitIndex)
  const digits = unitIndex === 0 || amount >= 100 ? 0 : amount >= 10 ? 1 : 2
  const formatted = amount.toFixed(digits).replace(/(\.\d*?[1-9])0+$|\.0+$/, '$1').replace('.', ',')
  return `${formatted} ${BYTE_UNITS[unitIndex]}`
}

export function formatStorageDate(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}
