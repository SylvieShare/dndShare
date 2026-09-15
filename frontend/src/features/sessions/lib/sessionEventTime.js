export function sessionEventTime(value, now = new Date()) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const time = date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
  if (date.toDateString() === now.toDateString()) return time
  const day = date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', ...(date.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}) })
  return `${day}, ${time}`
}
