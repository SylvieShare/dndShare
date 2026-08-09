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
  return {
    RESOLVED: 'Завершена',
    ARCHIVED: 'В архиве',
    IN_PROGRESS: 'В работе',
    APPROVAL: 'Нужно решение',
    ANSWER: 'Ждёт ответа',
    UNAPPROVED: 'Не одобрена',
    OPEN: 'В очереди',
  }[errorReportStatusKey(report)]
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
