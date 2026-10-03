import { describe, expect, it, vi } from 'vitest'
import { characterSteps } from './character'
import { sessionSteps } from './session'

describe.each([false, true])('money transfer tutorials (mobile=%s)', mobile => {
  it('explains the player row and transfer in the character sheet without executing it', () => {
    const action = vi.fn(), target = vi.fn()
    const step = characterSteps({ mobile, dnd: true, action, target }).find(step => step.id === 'inventory')
    expect(step.body).toContain('«Дать денег»')
    expect(step.body).toContain('без класса, расы и троеточия')
    expect(step.body).toContain('полоской под именем')
    expect(step.body).toContain('сразу списываются')
    expect(step.body).toContain('справа от числа внутри дисплея')
    expect(step.body).toContain('зелёным или красным в превью')
    expect(action).not.toHaveBeenCalled()
  })
  it.each([false, true])('covers the session role dm=%s', dm => {
    const action = vi.fn()
    const steps = sessionSteps({ mobile, dm, target: vi.fn(), action, showView: vi.fn() })
    const step = steps.find(step => step.id === (dm ? 'events' : 'party'))
    expect(step.body).toContain(dm ? 'Передача денег' : '«Дать денег»')
    if (dm) expect(step.body).toContain('валюту и сумму одной записью')
    else expect(step.body).toContain('без класса, расы и троеточия')
    expect(action).not.toHaveBeenCalled()
  })
})
