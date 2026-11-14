import {test,expect} from '@playwright/test'
import {weaponSheetFixture} from './fixtures/weapon-sheet'
function paletteProbe(node){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=1
  const context=canvas.getContext('2d')
  const rgb=color=>{context.clearRect(0,0,1,1);context.fillStyle=color;context.fillRect(0,0,1,1);return [...context.getImageData(0,0,1,1).data].slice(0,3)}
  const luminance=color=>rgb(color).map(value=>{value/=255;return value<=.04045?value/12.92:((value+.055)/1.055)**2.4}).reduce((sum,value,index)=>sum+value*[.2126,.7152,.0722][index],0)
  const contrast=(left,right)=>{const a=luminance(left),b=luminance(right);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05)}
  const style=getComputedStyle(node)
  if(node.classList.contains('weapon-metrics__identity')){
    return {width:parseFloat(style.borderInlineEndWidth),contrast:contrast(style.borderInlineEndColor,getComputedStyle(node.closest('.weapon-metrics__cell')).backgroundColor)}
  }
  let surface=node.parentElement
  while(surface.parentElement&&getComputedStyle(surface).backgroundColor==='rgba(0, 0, 0, 0)')surface=surface.parentElement
  return {foreground:rgb(style.color),iconContrast:contrast(style.color,style.backgroundColor),surfaceContrast:contrast(style.backgroundColor,getComputedStyle(surface).backgroundColor)}
}
for(const width of [390,834,1440])test(`menu actions and weapon dividers remain distinct at ${width}`,async({page},info)=>{
  await page.setViewportSize({width,height:1000})
  await page.emulateMedia({reducedMotion:'reduce'})
  await weaponSheetFixture(page)
  await page.goto('/char/test?tab=weapons',{waitUntil:'networkidle'})
  const card=page.locator('.w-card:visible').first()
  for(const divider of await card.locator('.weapon-metrics__identity').all()){
    const line=await divider.evaluate(paletteProbe)
    expect(line.width).toBeGreaterThanOrEqual(1)
    expect(line.contrast).toBeGreaterThan(1.25)
  }
  await card.screenshot({path:info.outputPath('weapon-dividers.png'),animations:'disabled'})
  await card.locator('.w-name').click()
  const menu=page.getByRole('menu',{name:'Действия: Тестовое копьё',exact:true})
  const colors=[]
  for(const name of ['Открыть описание','Изменить','Удалить']){
    const button=menu.getByRole('button',{name,exact:true})
    const resting=await button.evaluate(paletteProbe)
    colors.push(resting.foreground)
    expect(resting.surfaceContrast).toBeGreaterThan(1.25)
    expect(resting.iconContrast).toBeGreaterThanOrEqual(3)
    await button.hover()
    await expect.poll(()=>button.evaluate(paletteProbe).then(palette=>palette.iconContrast)).toBeGreaterThanOrEqual(3)
    await page.mouse.move(0,0)
  }
  expect(colors[0][2]).toBeGreaterThan(colors[0][0])
  expect(colors[1][0]).toBeGreaterThan(colors[1][2])
  expect(colors[2][0]).toBeGreaterThan(colors[2][1])
  await menu.screenshot({path:info.outputPath('menu-colors.png'),animations:'disabled'})
})
