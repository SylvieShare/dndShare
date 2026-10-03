export function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function groupOccurrences(occurrences, today = localDate()) {
  const sorted = [...occurrences].sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999') || a.number - b.number || a.id - b.id)
  const upcoming = sorted.filter(row => row.date && row.date >= today)
  return {
    next: upcoming[0] || null,
    future: upcoming.slice(1),
    past: sorted.filter(row => row.date && row.date < today),
    undated: sorted.filter(row => !row.date),
  }
}

export function occurrenceDate(value, options = { day: 'numeric', month: 'long', year: 'numeric' }) {
  if (!value) return 'Дата не задана'
  return new Intl.DateTimeFormat('ru-RU', options).format(new Date(`${value}T12:00:00`))
}

export function occurrenceGroups(groups, decorate = row => row) {
  return [
    { key: 'past', label: 'Прошедшие', items: groups.past.map(decorate) },
    { key: 'next', label: 'Следующая', items: groups.next ? [decorate(groups.next)] : [] },
    { key: 'future', label: 'Будущие', items: groups.future.map(decorate) },
    { key: 'undated', label: 'Без даты', items: groups.undated.map(decorate) },
  ].filter(group => group.items.length)
}

export function preferredOccurrence(occurrences, today = localDate()) {
  const groups = groupOccurrences(occurrences, today)
  return groups.next?.date === today ? groups.next : groups.past.at(-1) || groups.next || groups.undated.at(-1) || null
}

export function nextOccurrenceNumber(occurrences) { return Math.max(0, ...occurrences.map(row => row.number)) + 1 }
