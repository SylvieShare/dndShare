import { fetchPost } from '@/shared/api/http'

export function createErrorReport(report) {
  return fetchPost('/error-reports', report)
}
