import { fetchDelete, fetchGet, fetchPost, fetchPatch } from '@/shared/api/http'

export function getErrorReports() {
  return fetchGet('/admin-panel/error-reports?limit=500')
}

export function deleteErrorReport(id) {
  return fetchDelete(`/admin-panel/error-reports/${id}`)
}

export function setErrorReportApproval(id, approved) {
  return fetchPatch(`/admin-panel/error-reports/${id}/approval`, { approved })
}

export function answerErrorReport(id, message) {
  return fetchPost(`/admin-panel/error-reports/${id}/messages`, { message })
}

export function reopenErrorReport(id) {
  return fetchPost(`/admin-panel/error-reports/${id}/reopen`)
}

export function approveSeriousErrorReportChange(id) {
  return fetchPost(`/error-report-review/reports/${id}/serious-approval`)
}
