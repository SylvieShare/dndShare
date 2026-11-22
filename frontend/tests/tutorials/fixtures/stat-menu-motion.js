import { expect } from '@playwright/test'

export async function recordStatMenuExit(page) {
  await page.evaluate(() => {
    window.statMenuExits = []
    document.addEventListener('transitionrun', event => {
      const panel = event.target
      if (!panel.matches('[role="menu"].share-popover-action-leave-active')) return
      const animation = panel.getAnimations().find(item => item.transitionProperty === event.propertyName)
      const lastFrame = animation?.effect.getKeyframes().at(-1)
      const destination = event.propertyName === 'opacity' ? Number(lastFrame?.opacity)
        : lastFrame?.transform ? Number(new DOMMatrix(lastFrame.transform).a.toFixed(2)) : null
      window.statMenuExits.push({
        name: panel.getAttribute('aria-label'), property: event.propertyName, destination,
        inert: panel.inert, pointerEvents: getComputedStyle(panel).pointerEvents,
      })
    })
  })
}

export async function expectStatMenuExit(page, name, dismiss) {
  const menu = page.getByRole('menu', { name, exact: true })
  await expect(menu).toHaveCSS('transform', 'none')
  const start = await page.evaluate(() => window.statMenuExits.length)
  await dismiss()
  await expect(menu).toHaveCount(0)
  await expect.poll(() => page.evaluate(index => window.statMenuExits.slice(index), start)).toEqual(expect.arrayContaining([
    { name, property: 'opacity', destination: 0, inert: true, pointerEvents: 'none' },
    { name, property: 'transform', destination: 0.96, inert: true, pointerEvents: 'none' },
  ]))
}
