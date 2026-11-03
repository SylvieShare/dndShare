import {test,expect} from '@playwright/test'
import {canvasFrame} from './editorHelpers'
async function settled(page) { await page.evaluate(async()=>{await document.fonts.ready; await Promise.all(document.getAnimations().filter(a=>a.effect?.getTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{})))}) }

for(const width of [390,834,1920]) {
 const height=width===390?844:width===834?1112:1080
 test(`native parity scene and panels at ${width}px`,async({page},testInfo)=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message))
  await page.setViewportSize({width,height})
  await page.goto('/tests/maps/fixtures/maps.html?mode=editor&nativeReview')
  await expect(page.getByText('Подготавливаем карту…')).toHaveCount(0)
  await expect.poll(()=>page.evaluate(()=>new Set(window.loadedModels).size)).toBeGreaterThanOrEqual(2)
  await canvasFrame(page)
  await settled(page)
  await page.screenshot({path:testInfo.outputPath(`web-editor-${width}.png`)})
  await page.getByRole('button',{name:'Области',exact:true}).click()
  await expect(page.getByRole('button',{name:'Зал',exact:true})).toBeVisible()
  await settled(page)
  await page.screenshot({path:testInfo.outputPath(`web-areas-${width}.png`)})
  await page.getByRole('button',{name:'Настройки',exact:true}).click()
  await expect(page.getByLabel('Название карты', {exact:true})).toBeVisible()
  await settled(page)
  await page.screenshot({path:testInfo.outputPath(`web-settings-${width}.png`)})
  expect(errors).toEqual([])
 })
 test(`native parity library at ${width}px`,async({page},testInfo)=>{
  await page.setViewportSize({width,height})
  await page.goto('/tests/maps/fixtures/maps.html?mode=library&nativeReview')
  await expect(page.getByText('Крепость на переправе',{exact:true})).toBeVisible()
  await expect(page.locator('.map-thumbnail')).toHaveAttribute('aria-busy','false')
  await expect(page.locator('.map-thumbnail img')).toBeVisible()
  await settled(page)
  await page.screenshot({path:testInfo.outputPath(`web-library-${width}.png`)})
 })
}
