export function timerRemainingMs(timer, serverNowMs) {
  if (timer?.paused) return Math.max(0, Number(timer.remainingMs) || 0)
  const endsAt = Number(timer?.endsAt)
  return Number.isFinite(endsAt) ? Math.max(0, endsAt - serverNowMs) : 0
}

export function timerProgress(timer, serverNowMs) {
  const duration = Math.max(1, Number(timer?.durationMs) || 1)
  return Math.min(1, Math.max(0, 1 - timerRemainingMs(timer, serverNowMs) / duration))
}

export function formatTimerDuration(milliseconds) {
  const totalSeconds = Math.max(0, Math.ceil((Number(milliseconds) || 0) / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const padded = value => String(value).padStart(2, '0')
  return hours > 0
    ? `${padded(hours)}:${padded(minutes)}:${padded(seconds)}`
    : `${padded(minutes)}:${padded(seconds)}`
}
