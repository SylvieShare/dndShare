export const ERROR_REPORT_REQUEST_EVENT = 'dndshare:error-report-request'

export function requestErrorReport() {
  window.dispatchEvent(new Event(ERROR_REPORT_REQUEST_EVENT))
}
