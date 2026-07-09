import { fetchGet, fetchPost } from '@/shared/api/http'

export function getAvailableJobs() {
  return fetchGet('/admin-panel/jobs/available')
}

export function getJobRuns() {
  return fetchGet('/admin-panel/jobs')
}

export function startJob(code) {
  return fetchPost(`/admin-panel/jobs/${code}/start`, {})
}

export function cancelJob(id) {
  return fetchPost(`/admin-panel/jobs/${id}/cancel`, {})
}
