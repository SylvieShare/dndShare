import { expect, test } from '@playwright/test'
test.beforeEach(async ({ page }) => {
  page.on('pageerror', error => { throw error })
  await page.route(url => url.pathname.startsWith('/api/'), route => new URL(route.request().url()).pathname.startsWith('/api/') ? route.fulfill({ json: { items: [] } }) : route.continue())
})
for (const width of [1280, 390]) {
  test(`abilities below cover, lineage benefits and size notes (${width})`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 })
    await page.goto('/tests/species/fixture.html')
    const cover = page.locator('.race-card'), list = page.getByRole('region', { name: 'Способности расы' })
    await expect(list.locator('.race-ability-card')).toHaveCount(2)
    await expect(cover).not.toContainText('Способности')
    await expect(cover).toContainText('Гуманоид')
    expect((await list.boundingBox()).y).toBeGreaterThanOrEqual((await cover.boundingBox()).y + (await cover.boundingBox()).height)
    const picker = page.getByRole('region', { name: 'Выбор подрасы' })
    await picker.getByRole('button', { name: /Лесной гном/ }).click()
    await expect(picker.locator('.subrace-details')).toContainText('Малая иллюзия лесного гнома')
    await expect(picker.locator('.subrace-details')).not.toContainText('Заводное устройство')
    await picker.getByRole('button', { name: /Скальный гном/ }).click()
    await expect(picker.locator('.subrace-details')).toContainText('Заводное устройство')
    await expect(picker.locator('.subrace-details')).not.toContainText('Малая иллюзия лесного гнома')
    await expect(picker.locator('.race-ability-card p')).toHaveCount(0)
    await list.getByRole('button', { name: /Гномья хитрость/ }).click()
    await expect(page.getByRole('dialog')).toContainText('спасброски Интеллекта')
    await page.getByRole('button', { name: 'Закрыть', exact: true }).click()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  })
  for (const title of ['Раса', 'Класс', 'Предыстория']) {
    test(`back beside ${title} heading (${width})`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      await page.goto('/tests/species/fixture.html?stage=' + encodeURIComponent(title))
      const heading = await page.getByRole('heading', { name: title, exact: true }).boundingBox()
      const back = page.getByRole('button', { name: /Назад/ })
      const button = await back.boundingBox(), cover = await page.locator('.fixture-cover').boundingBox()
      expect(button.x).toBeGreaterThan(heading.x + heading.width)
      expect(button.y + button.height).toBeLessThanOrEqual(cover.y)
      await back.click()
      await expect(back).toHaveCount(0)
    })
  }
}
test('future abilities are visible with level labels; size choices retain explanatory heights', async ({ page }) => {
  await page.goto('/tests/species/fixture.html?aasimar')
  await expect(page.locator('.race-ability-card')).toHaveCount(5)
  await expect(page.locator('.race-ability-card').filter({ hasText: 'Небесное откровение' })).toContainText('С 3-го уровня')
  await page.getByRole('button', { name: /Маленький Выбрать/ }).click()
  await expect(page.locator('.race-card-fact').filter({ hasText: 'Размер' })).toContainText('Маленький')
  await expect(page.locator('.variant-card').filter({ hasText: 'Маленький' })).toContainText('2–4 футов')
  await expect(page.locator('.race-lore')).not.toContainText('Тип существа:')
  await expect(page.locator('.race-lore')).not.toContainText('Скорость:')
})

for (const reducedMotion of ['no-preference', 'reduce']) {
  test(`race reveal stays at the top and back restores the list (${reducedMotion})`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion })
    await page.setViewportSize({ width: 390, height: 850 })
    await page.goto('/tests/species/fixture.html?unselected&scrolling')
    const main = page.locator('.cc-main')
    const choice = main.locator('.race-card').last()
    await choice.scrollIntoViewIfNeeded()
    const listScroll = await main.evaluate(node => node.scrollTop)
    expect(listScroll).toBeGreaterThan(0)

    await page.evaluate(() => {
      const scroller = document.querySelector('.cc-main')
      const frames = []
      window.raceReveal = new Promise(resolve => {
        function inspect(now) {
          const card = scroller.querySelector('.race-card--selected')
          if (card) {
            const panel = scroller.querySelector('.illustrated-choice-stage')
            frames.push({
              time: now,
              scroll: scroller.scrollTop,
              offset: card.getBoundingClientRect().top - panel.getBoundingClientRect().top,
              cards: scroller.querySelectorAll('.race-card').length,
              animation: getComputedStyle(panel).animationName,
            })
          }
          if (frames.length && now - frames[0].time >= 700) resolve(frames)
          else requestAnimationFrame(inspect)
        }
        requestAnimationFrame(inspect)
      })
    })
    await choice.click()
    const frames = await page.evaluate(() => window.raceReveal)
    expect(frames.every(frame => frame.scroll === 0 && Math.abs(frame.offset) < 2 && frame.cards === 1)).toBe(true)
    if (reducedMotion === 'reduce') expect(frames.every(frame => frame.animation === 'none')).toBe(true)

    await main.getByRole('button', { name: /К выбору расы/ }).click()
    await expect.poll(async () => Math.abs(await main.evaluate(node => node.scrollTop) - listScroll)).toBeLessThan(2)
    await expect(choice).toBeFocused()
  })
}
