const STATUS_PRESENTATION = {
  OPEN: 'В очереди',
  IN_PROGRESS: 'В работе',
  ANSWER: 'Ждёт ответа',
  APPROVAL: 'Нужно решение',
  UNAPPROVED: 'Не одобрена',
  RESOLVED: 'Завершена',
  ARCHIVED: 'В архиве',
}

const STATUS_ORDER = ['OPEN', 'IN_PROGRESS', 'ANSWER', 'APPROVAL', 'UNAPPROVED', 'RESOLVED', 'ARCHIVED']

export function errorReportStatusKey(report) {
  if (report.status === 'RESOLVED') return 'RESOLVED'
  if (report.status === 'ARCHIVED') return 'ARCHIVED'
  if (report.status === 'IN_PROGRESS') return 'IN_PROGRESS'
  if (report.waitingForSeriousApproval) return 'APPROVAL'
  if (report.waitingForAnswer) return 'ANSWER'
  if (!report.approved) return 'UNAPPROVED'
  return 'OPEN'
}

export function errorReportStatusLabel(report) {
  return STATUS_PRESENTATION[errorReportStatusKey(report)]
}

export function errorReportStatusSummary(reports) {
  const counts = new Map()
  for (const report of reports || []) {
    const key = errorReportStatusKey(report)
    counts.set(key, (counts.get(key) || 0) + 1)
  }
  return STATUS_ORDER
    .filter(key => counts.has(key))
    .map(key => ({ key, label: STATUS_PRESENTATION[key], count: counts.get(key) }))
}

export function shouldShowErrorReportAuthor(report, currentUserId) {
  return report.userId == null || report.userId !== currentUserId
}

export function errorReportDisplayTitle(report, fallbackLength = 84) {
  const title = String(report?.title || '').trim()
  if (title) return title
  const description = String(report?.description || '').replace(/\s+/g, ' ').trim()
  const characters = [...description]
  if (characters.length <= fallbackLength) return description || 'Без описания'
  return `${characters.slice(0, Math.max(1, fallbackLength - 1)).join('').trimEnd()}…`
}
