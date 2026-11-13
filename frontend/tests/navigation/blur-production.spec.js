import { test,expect } from '@playwright/test'
import { installCharacterChromeFixture } from './characterChromeFixture.js'

for(const width of [390,834,1440]) test(`production page headers share opaque surfaces at ${width}`,async({page})=>{
  await page.setViewportSize({width,height:700});await installCharacterChromeFixture(page);await page.goto('/chars')
  const header=page.locator('.app-header')
  await expect(header).toHaveCSS('background-color','rgb(48, 42, 61)')
  await expect(header.locator('.workspace-header-backdrop')).toHaveCount(0)
  await expect(header.locator('.workspace-subheader')).toHaveCount(0)
  await page.evaluate(()=>scrollTo(0,250));await expect(header).toHaveAttribute('data-workspace-scrolled','')
  await page.evaluate(()=>scrollTo(0,0));await expect(header).not.toHaveAttribute('data-workspace-scrolled')
  await page.locator('.char-card').first().getByText('Персонаж 0',{exact:true}).click()
  await expect(page.locator('.character-workspace-header')).toHaveCSS('background-color','rgb(48, 42, 61)')
  await expect(page.locator('.character-workspace-header .workspace-header-backdrop')).toHaveCount(0)
})

test('tablet navigation keeps readable captions in the shared production subheader',async({page})=>{
  await page.setViewportSize({width:834,height:700});await installCharacterChromeFixture(page);await page.goto('/chars')
  await page.locator('.char-card').first().getByText('Персонаж 0',{exact:true}).click()
  const nav=page.getByRole('navigation',{name:'Раздел персонажа'})
  await expect(nav).toHaveClass(/share-icon-navigation--content/)
  await expect(nav.getByRole('button',{name:'Статы',exact:true}).locator('.share-icon-navigation__label')).toHaveCSS('font-size','12px')
})
