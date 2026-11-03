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
 test(`native parity loading remains editable at ${width}px`,async({page},testInfo)=>{
  await page.setViewportSize({width,height})
  await page.goto('/tests/maps/fixtures/maps.html?mode=editor&nativeReview&downloadExample&modelRetry&retryModel=22222222-2222&holdModel=22222222-2222')
  await expect(page.getByRole('dialog',{name:'Проблемы загрузки карты'})).toBeVisible()
  await page.getByRole('button',{name:'Закрыть сведения об ошибках',exact:true}).click()
  await page.waitForFunction(()=>{
   const files=Object.entries(window.assetAttempts||{}).filter(([url])=>url.includes('22222222-2222'))
   return files.length>0&&files.every(([,attempt])=>attempt>=3)&&window.modelTransfers.some(url=>url.includes('22222222-2222'))
  })
  await page.evaluate(()=>window.advanceModelTransfers(.5))
  await expect(page.getByRole('dialog',{name:'Проблемы загрузки карты'})).toHaveCount(0)
  await page.getByRole('button',{name:'Настройки',exact:true}).click()
  await page.getByLabel('Название карты',{exact:true}).fill('Редактирование во время загрузки')
  await page.getByLabel('Название карты',{exact:true}).press('Tab')
  await expect.poll(()=>page.evaluate(()=>window.lastSaved?.name)).toBe('Редактирование во время загрузки')
  await page.getByRole('button',{name:'Свернуть панель карты',exact:true}).click()
  await settled(page)
  await page.screenshot({path:testInfo.outputPath(`web-downloads-${width}.png`)})
  await page.evaluate(()=>window.finishModelTransfers())
  await expect(page.locator('.map-download-manager')).toHaveCount(0)
 })
}
