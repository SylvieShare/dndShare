import { expect, test, vi } from 'vitest'
import { characterSteps } from './character'
for (const mobile of [false, true]) {
  test(`image upload guidance matches the device (${mobile ? 'mobile' : 'desktop'})`, () => {
    const step = characterSteps({ mobile, dnd: true, action: vi.fn(), target: vi.fn() }).find(s => s.id === 'stats')
    expect(step.body).toContain(mobile ? 'портрет до 8 МБ' : 'до 5 и 8 МБ')
    expect(step.body).toContain('преобразуются в WebP')
    expect(step.body).toContain(mobile ? 'При создании персонажа' : 'портрет на вкладке «Личность»')
  })
  test(`weapon tutorial explains bonus action damage (${mobile ? 'mobile' : 'desktop'})`, () => {
    const step = characterSteps({ mobile, dnd: true, action: vi.fn(), target: vi.fn() }).find(s => s.id === 'weapons')
    expect(step.body).toContain('Урон бонусным действием')
    expect(step.body).toContain('отрицательный и магические бонусы остаются')
    expect(step.body).toContain('Сражение двумя оружиями')
  })
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
