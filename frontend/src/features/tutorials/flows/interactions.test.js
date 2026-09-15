import { describe, expect, it, vi } from 'vitest'
import { characterSteps } from './character'
import { sessionSteps } from './session'

describe('interaction tutorial coverage', () => {
  it.each([false, true])('explains the player menu, secrecy and chronicle for mobile=%s without sending actions', mobile => {
    const action = vi.fn(), target = vi.fn(), showView = vi.fn()
    for (const dnd of [false, true]) {
      const steps = characterSteps({ mobile, dnd, target, action })
      const text = steps.map(step => step.body).join(' ')
      expect(text).toContain('«Чат»')
      expect(text).toContain('мастеру в хронике')
      expect(text).toContain('не видя его')
    }
    const player = sessionSteps({ mobile, dm: false, target, action, showView })
    expect(player.map(step => step.body).join(' ')).toContain('«Чат»')
    const dm = sessionSteps({ mobile, dm: true, target, action, showView })
    expect(dm.find(step => step.id === 'events').body).toContain('Фильтр «Общение»')
    expect(action).not.toHaveBeenCalled()
    expect(showView).not.toHaveBeenCalled()
  })
})

it.each([false, true])('opens the settings tab for the DM and preserves the player tutorial action, mobile=%s', async mobile => {
  const target = vi.fn(), action = vi.fn(), showView = vi.fn(), context = { onCleanup: vi.fn() }
  const dm = sessionSteps({ mobile, dm: true, target, action, showView })
  expect(dm.find(step => step.id === 'tools')).toBeTruthy()
  await dm.find(step => step.id === 'settings').enter(context)
  expect(showView).toHaveBeenCalledWith('settings', context)
  expect(action).not.toHaveBeenCalled()
  const player = sessionSteps({ mobile, dm: false, target, action, showView })
  await player.find(step => step.id === 'settings').enter(context)
  expect(action).toHaveBeenCalledWith('session-settings', context)
})
