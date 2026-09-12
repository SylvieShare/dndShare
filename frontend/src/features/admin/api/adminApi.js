import { fetchDelete, fetchGet, fetchPost } from '@/shared/api/http'

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
