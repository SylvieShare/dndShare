import { describe, expect, it } from 'vitest'
import { formatTimerDuration, timerProgress, timerRemainingMs } from './sessionTimers'

describe('session timers', () => {
  it('counts running timers from their absolute server deadline', () => {
    const timer = { durationMs: 120_000, endsAt: 1_090_000, paused: false }
    expect(timerRemainingMs(timer, 1_000_000)).toBe(90_000)
    expect(timerProgress(timer, 1_000_000)).toBeCloseTo(0.25)
    expect(timerRemainingMs(timer, 1_100_000)).toBe(0)
  })

  it('keeps paused remaining time frozen', () => {
    const timer = { durationMs: 60_000, remainingMs: 42_000, paused: true }
    expect(timerRemainingMs(timer, 9_999_999)).toBe(42_000)
    expect(timerProgress(timer, 9_999_999)).toBeCloseTo(0.3)
  })

  it('formats short and long durations without losing hours', () => {
    expect(formatTimerDuration(90_000)).toBe('01:30')
    expect(formatTimerDuration(3_661_000)).toBe('01:01:01')
    expect(formatTimerDuration(-1)).toBe('00:00')
  })
})
