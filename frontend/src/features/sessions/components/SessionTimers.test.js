import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const read = path => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8')
const control = read('./SessionTimerControl.vue')
const stack = read('./SessionTimerStack.vue')
const toolbar = read('./ChapterGraphToolbar.vue')
const page = read('../pages/ViewSession.vue')
const publicScreen = read('../pages/ViewEncounterScreen.vue')
const composable = read('../composables/useSessionTimers.js')
const api = read('../../../shared/api/sessionsApi.js')

describe('session timer workspace', () => {
  it('places timer creation in the session header and cards only in the DM workspace', () => {
    expect(toolbar).toContain('<SessionTimerControl')
    expect(control).toContain('Запустить таймер')
    expect(control).toContain('Быстрый выбор длительности')
    expect(control).toContain('Показывать в трансляции')
    expect(control).toContain('broadcast: broadcast.value')
    expect(page).toContain('<SessionTimerStack v-if="isDm"')
    expect(publicScreen).not.toContain('SessionTimerStack')
    expect(publicScreen).toContain('class="broadcast-timers"')
  })

  it('supports pause, resume, added time and a completed removal state', () => {
    expect(stack).toContain("timer.paused ? timers.resume(timer.id) : timers.pause(timer.id)")
    expect(stack).toContain('timers.addTime(timer.id, 60_000)')
    expect(stack).toContain('timers.addTime(timer.id, 300_000)')
    expect(stack).toContain('Время вышло')
    expect(stack).toContain('Убрать')
    expect(composable).toContain("const pause = timerId => mutate(timerId, { action: 'pause' })")
    expect(composable).toContain("const resume = timerId => mutate(timerId, { action: 'resume' })")
    expect(stack).toContain('timer.broadcast')
  })

  it('renders each timer as a draggable window below the session header and remembers its position per session', () => {
    expect(page).toContain(':session-uuid="sessionUuid"')
    expect(page.indexOf('<SessionTimerStack')).toBeGreaterThan(page.indexOf('<ChapterGraphTab'))
    expect(page.indexOf('<SessionTimerStack')).toBeLessThan(page.indexOf('</ChapterGraphTab>'))
    expect(stack).toContain('@pointerdown.stop="startDrag($event, timer, index)"')
    expect(stack).toContain("window.addEventListener('pointermove', onPointerMove)")
    expect(stack).toContain('dnd-share:session-timer-windows:v1:')
    expect(stack).toContain('localStorage.setItem(storageKey()')
    expect(stack).toContain('class="session-timer-windows"')
    expect(control).toContain('Перетаскивайте окна за заголовок')
  })

  it('persists timers through the owner-only session API and uses server clock offset', () => {
    expect(api).toContain('getSessionTimers')
    expect(api).toContain('/timers/${timerId}')
    expect(composable).toContain('serverOffsetMs')
    expect(composable).toContain('response?.serverTime')
    expect(page).toContain('sessionTimers.load()')
    expect(page).toContain('sessionTimers.dispose()')
  })
})
