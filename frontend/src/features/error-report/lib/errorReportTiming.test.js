import { describe, expect, it } from 'vitest'
import { formatReportDuration, reportTimingSegments } from './errorReportTiming'

describe('report timing', () => {
  it('adds only the active phase and caps it at lease expiry', () => {
    const timing = { phases: [{ phase: 'analysis', durationMs: 1000 }, { phase: 'test', durationMs: 5000 }],
      snapshotAt: '2026-11-12T12:00:00Z', activeUntil: '2026-11-12T12:01:00Z', activePhase: 'test' }
    expect(reportTimingSegments(timing, 20000).map(item => item.value)).toEqual([1000, 0, 25000, 0, 0])
    expect(reportTimingSegments(timing, 3600000)[2].value).toBe(65000)
    expect(reportTimingSegments({ ...timing, activePhase: null }, 3600000)[2].value).toBe(5000)
  })
  it('handles empty data, clock skew, and long durations', () => {
    expect(reportTimingSegments(null).map(item => item.value)).toEqual([0, 0, 0, 0, 0])
    expect(formatReportDuration(0)).toBe('0 с')
    expect(formatReportDuration(999)).toBe('<1 с')
    expect(formatReportDuration(125000)).toBe('2 мин 5 с')
    expect(formatReportDuration(3720000)).toBe('1 ч 2 мин')
    expect(formatReportDuration(90000000)).toBe('1 д 1 ч')
  })
})
