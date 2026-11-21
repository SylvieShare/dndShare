import { expect, test } from '@playwright/test'
import { fixture } from '../tutorials/fixtures/character-layout'
import { installCharacterChromeFixture } from './characterChromeFixture.js'

test('Android safe area belongs to the header and drawer, without padding the document', async ({ page }) => {
  await page.setViewportSize({width:390,height:1000})
  await fixture(page)
  await page.route('**/api/handbook/sync?**', route => route.fulfill({json:{protocol:1,entries:[],hasMore:false,cursor:'empty',visibleIds:[],metadata:{types:[],suggests:{},suggestTypes:[],books:[]}}}))
  await page.goto('/chars')
  await page.evaluate(() => {
    document.documentElement.dataset.platform='android'
    document.documentElement.style.setProperty('--native-safe-top','24px')
  })
  await page.getByRole('button',{name:'Открыть меню',exact:true}).click()
  await expect(page.locator('.desktop-sidebar--drawer')).toHaveCSS('padding-top','24px')
  await expect(page.locator('html')).toHaveCSS('padding-top','0px')
  await expect(page.locator('.workspace-header').first()).toHaveCSS('padding-top','24px')
})

test('Android contains page overscroll and restores the character list position', async ({ page }) => {
  await page.setViewportSize({ width: 475, height: 751 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await installCharacterChromeFixture(page)
  await page.goto('/chars')
  await page.evaluate(() => { document.documentElement.dataset.platform = 'android' })

  const stage = page.locator('.page-transition-stage')
  const header = page.locator('.app-header')
  const cards = page.locator('.char-card')
  await expect(cards).toHaveCount(30)
  expect(await page.evaluate(() => document.scrollingElement.scrollHeight - document.scrollingElement.clientHeight)).toBe(0)
  await expect(stage).toHaveCSS('overscroll-behavior-y', 'contain')
  await expect(stage).toHaveCSS('overflow-y', 'auto')
  await stage.evaluate(node => { node.scrollTop = 500 })
  const saved = await stage.evaluate(node => node.scrollTop)
  expect(saved).toBeGreaterThan(0)
  expect(await page.evaluate(() => window.scrollY)).toBe(0)
  await expect(header).toHaveAttribute('data-workspace-scrolled', '')
  expect((await header.boundingBox()).y).toBeCloseTo(0, 0)

  const card = cards.nth(5)
  await card.scrollIntoViewIfNeeded()
  const beforeOpen = await stage.evaluate(node => node.scrollTop)
  await card.click()
  await expect(page).toHaveURL(/\/char\/chrome-5$/)
  await expect(stage).not.toHaveAttribute('data-workspace-scroll')
  await expect(stage).toHaveCSS('overflow-y', 'visible')
  await page.goBack()
  await expect(page).toHaveURL(/\/chars$/)
  await expect.poll(() => stage.evaluate(node => node.scrollTop)).toBe(beforeOpen)
})
