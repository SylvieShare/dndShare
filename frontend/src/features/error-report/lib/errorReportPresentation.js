export function errorReportStatusKey(report) {
  if (report.status === 'RESOLVED') return 'RESOLVED'
  if (report.status === 'ARCHIVED') return 'ARCHIVED'
  if (report.waitingForSeriousApproval) return 'APPROVAL'
  if (report.waitingForAnswer) return 'ANSWER'
  if (!report.approved) return 'UNAPPROVED'
  return 'OPEN'
}

export function errorReportStatusLabel(report) {
  return {
    RESOLVED: 'Завершена',
    ARCHIVED: 'В архиве',
    APPROVAL: 'Нужно решение',
    ANSWER: 'Ждёт ответа',
    UNAPPROVED: 'Не одобрена',
    OPEN: 'В очереди',
  }[errorReportStatusKey(report)]
}

export function shouldShowErrorReportAuthor(report, currentUserId) {
  return report.userId == null || report.userId !== currentUserId
}
