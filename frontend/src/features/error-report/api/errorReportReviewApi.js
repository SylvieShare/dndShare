import { fetchPost } from '@/shared/api/http'

export async function getReviewErrorReports() {
  const response = await fetch('/api/error-report-review/reports?limit=500', {
    headers: { 'Content-Type': 'application/json;charset=utf-8' },
  })
  if (!response.ok) throw new Error(String(response.status))
  return response.json()
}

export function answerReviewErrorReport(id, message) {
  return fetchPost(`/error-report-review/reports/${id}/messages`, { message })
}

export function approveSeriousErrorReportChange(id) {
  return fetchPost(`/error-report-review/reports/${id}/serious-approval`)
}

export function archiveReviewErrorReport(id) {
  return fetchPost(`/error-report-review/reports/${id}/archive`)
}
