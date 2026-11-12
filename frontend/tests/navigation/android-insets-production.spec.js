import { expect, test } from '@playwright/test'
import { fixture } from '../tutorials/fixtures/character-layout'

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
