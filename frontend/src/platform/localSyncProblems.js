import { reactive } from 'vue'

export const localSyncProblems = reactive({ event: null })
const active = new Map()
let recoveredSources = new Set()
let sequence = 0

export function syncProblem(error) {
  const failure = typeof error === 'string' ? { message: error } : error || {}
  const status = Number(failure.status) || 0
  if (failure.syncTransient || ['AbortError', 'TimeoutError'].includes(failure.name) || [401, 408, 429, 504].includes(status)) return null
  if (status === 426 || failure.code === 'SYNC_PROTOCOL') return {
    group: 'version', title: 'Требуется обновление', message: 'Версии приложения и сервера несовместимы. Обновите приложение или страницу.',
  }
  if (status === 409) return {
    group: 'conflict', title: 'Конфликт синхронизации', message: 'Версии данных расходятся. Откройте документ, чтобы проверить конфликтующие изменения.',
  }
  if (status === 507 && failure.cause) return {
    group: 'local:storage', title: 'Локальное хранилище недоступно', message: failure.message,
  }
  if (status >= 500) return {
    group: 'server', title: 'Ошибка синхронизации', message: `Сервер ответил ошибкой ${status}. Повторные попытки продолжатся в фоне.`,
  }
  const message = failure.message || 'Не удалось синхронизировать данные.'
  return { group: status ? `http:${status}` : `local:${message}`, title: 'Не удалось синхронизировать данные', message }
}

export function reportSyncProblem(error, source, accountId) {
  const problem = syncProblem(error)
  if (!problem || !accountId) return
  const incident = active.get(problem.group)
  if (incident) { incident.add(source); return }
  active.set(problem.group, new Set([source]))
  localSyncProblems.event = { ...problem, accountId, id: ++sequence }
}

export function resolveSyncProblem(source, { httpOnly = false } = {}) {
  for (const [group, sources] of active) {
    if (httpOnly && group.startsWith('local:')) continue
    sources.delete(source)
    if (sources.size) continue
    active.delete(group)
    if (localSyncProblems.event?.group === group) localSyncProblems.event = null
  }
}

export function resetSyncProblems() {
  active.clear()
  recoveredSources.clear()
  localSyncProblems.event = null
}

export function reportRecoveredSyncProblems(problems, sourceOf, accountId) {
  const current = new Set()
  for (const { url, error } of problems) {
    const source = sourceOf(url)
    current.add(source)
    reportSyncProblem(error, source, accountId)
  }
  for (const source of recoveredSources) if (!current.has(source)) resolveSyncProblem(source)
  recoveredSources = current
}
