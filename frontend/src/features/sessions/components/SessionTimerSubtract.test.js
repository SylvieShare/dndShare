import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const read = path => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8')
const stack = read('./SessionTimerStack.vue')
const composable = read('../composables/useSessionTimers.js')
const api = read('../../../shared/api/sessionsApi.js')

describe('session timer subtraction', () => {
  it('offers one and five minute decrease actions backed by the timer API', () => {
    expect(stack).toContain('timers.subtractTime(timer.id, 60_000)')
    expect(stack).toContain('timers.subtractTime(timer.id, 300_000)')
    expect(composable).toContain('subtractSessionTimerTime(sessionUuid, timerId, amountMs)')
    expect(api).toContain('/timers/${timerId}/subtract')
  })
})
