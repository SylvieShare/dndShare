import { expect, test, vi } from 'vitest'
import { characterSteps } from './character'
for (const mobile of [false, true]) {
  test(`edition tutorial only opens menu (${mobile ? 'mobile' : 'desktop'})`, async () => {
    const action = vi.fn(), target = vi.fn()
    const step = characterSteps({ mobile, dnd: true, action, target }).find(s => s.id === 'settings')
    expect(step.body).toContain('Сменить редакцию')
    expect(step.body).toContain('не конвертируются автоматически')
    const context = { onCleanup: vi.fn() }
    await step.enter(context)
    expect(action).toHaveBeenCalledExactlyOnceWith('character-menu', context)
    step.target()
    expect(target).toHaveBeenCalledWith('character-menu')
  })
}
