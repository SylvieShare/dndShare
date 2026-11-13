export const reportWorkPhases = [
  { key: 'analysis', label: 'Анализ', color: 'var(--info)' },
  { key: 'fix', label: 'Исправление', color: 'var(--accent)' },
  { key: 'test', label: 'Тестирование', color: 'var(--warning)' },
  { key: 'build', label: 'Сборка', color: 'var(--text-muted)' },
  { key: 'deploy', label: 'Раскатка', color: 'var(--success)' },
]

export function reportTimingSegments(timing, elapsedMs = 0) {
  const snapshot = Date.parse(timing?.snapshotAt)
  const until = Date.parse(timing?.activeUntil)
  const elapsed = Number.isFinite(snapshot) && Number.isFinite(until)
    ? Math.max(0, Math.min(elapsedMs, until - snapshot)) : 0
  return reportWorkPhases.map(phase => ({
    ...phase,
    value: Math.max(0, Number(timing?.phases?.find(item => item.phase === phase.key)?.durationMs) || 0)
      + (timing?.activePhase === phase.key ? elapsed : 0),
  }))
}

export function formatReportDuration(milliseconds) {
  const seconds = Math.floor(Math.max(0, Number(milliseconds) || 0) / 1000)
  if (!seconds) return milliseconds > 0 ? '<1 с' : '0 с'
  if (seconds < 60) return `${seconds} с`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} мин${seconds % 60 ? ` ${seconds % 60} с` : ''}`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} ч${minutes % 60 ? ` ${minutes % 60} мин` : ''}`
  return `${Math.floor(hours / 24)} д${hours % 24 ? ` ${hours % 24} ч` : ''}`
}
