import { fetchDelete, fetchGet, fetchPatch, fetchPost } from '@/shared/api/http'

export function getUsers() {
  return fetchGet('/admin-panel/users')
}

export function addRole(userId, role) {
  return fetchPost(`/admin-panel/users/${userId}/roles`, { role })
}

export function removeRole(userId, role) {
  return fetchDelete(`/admin-panel/users/${userId}/roles/${role}`)
}

export function resetPassword(userId, password) {
  return fetchPost(`/admin-panel/users/${userId}/password`, { password })
}

export function getLogs() {
  return fetchGet('/admin-panel/logs')
}

export function deleteLog(id) {
  return fetchDelete(`/admin-panel/logs/${id}`)
}

export function deleteAllLogs() {
  return fetchDelete('/admin-panel/logs')
}

export function getStats() {
  return fetchGet('/admin-panel/stats')
}

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
