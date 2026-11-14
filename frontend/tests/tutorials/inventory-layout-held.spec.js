import { test, expect } from '@playwright/test'
import { weaponSheetFixture } from './fixtures/weapon-sheet'
test.use({hasTouch:true})

for (const width of [390,834,1440]) test(`inventory has page-aligned larger cells, held dragging and compact money dialog at ${width}`,async({page},testInfo)=>{
  await page.setViewportSize({width,height:1000})
  const api=await weaponSheetFixture(page)
  api.document().values.items={equipped:[],sections:[{id:'bag',name:'Рюкзак',items:[
    {uid:'rope',count:1,override:{name:'Верёвка'}},{uid:'torch',count:1,override:{name:'Факел'}}
  ],slots:{rope:0,torch:1}}]}
  api.document().values.money={order:[1,2,3],amounts:{1:10,3:42}}
  api.suggests[17]=[{id:1,value:'мм'},{id:2,value:'см'},{id:3,value:'зм'}]
  await page.goto('/char/test?tab=inventory',{waitUntil:'networkidle'})
  const section=page.locator('[data-sheet-section="inventory"]:visible')
  const bag=section.locator('[data-sortable-container="sec_bag"]')
  const source=bag.getByRole('button',{name:'Верёвка',exact:true})
  await expect(source).toBeVisible()
  const boxes=await section.evaluate(node=>({section:node.getBoundingClientRect().x,grid:node.querySelector('.inventory-bag-grid').getBoundingClientRect().x,cell:node.querySelector('.inventory-bag-cell').getBoundingClientRect().width}))
  expect(Math.abs(boxes.section-boxes.grid)).toBeLessThan(1)
  expect(boxes.cell).toBeGreaterThanOrEqual(80)
  await source.click()
  await expect(page.getByRole('menuitem',{name:'Удалить предмет',exact:true})).toBeVisible()
  await page.keyboard.press('Escape')
  await source.scrollIntoViewIfNeeded()
  const from=await source.boundingBox(),target=await bag.locator('[data-sortable-slot="2"]').boundingBox()
  const start={x:from.x+from.width/2,y:from.y+from.height/2},end={x:target.x+target.width/2,y:target.y+target.height/2}
  if(width<1200){
    const touch=await page.context().newCDPSession(page)
    await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[start]})
    await expect(page.locator('.sortable-ghost')).toBeVisible()
    for(let step=1;step<=8;step++) await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:start.x+(end.x-start.x)*step/8,y:start.y+(end.y-start.y)*step/8}]})
    await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]})
    await touch.detach()
  }else{
    await page.mouse.move(start.x,start.y)
    await page.mouse.down()
    await expect(page.locator('.sortable-ghost')).toBeVisible()
    await page.mouse.move(end.x,end.y,{steps:8})
    await page.mouse.up()
  }
  await expect(bag.locator('[data-sortable-slot="2"]').getByRole('button',{name:'Верёвка',exact:true})).toBeVisible()
  await expect(page.getByRole('menu')).toHaveCount(0)
  await expect.poll(()=>api.document().values.items.sections[0].slots.rope).toBe(2)
  await page.reload({waitUntil:'networkidle'})
  await expect(bag.locator('[data-sortable-slot="2"]').getByRole('button',{name:'Верёвка',exact:true})).toBeVisible()
  await section.screenshot({path:testInfo.outputPath('inventory.png'),animations:'disabled'})
  await section.getByRole('button',{name:'Изменить кошелёк',exact:true}).click()
  const dialog=page.getByRole('dialog',{name:'Кошелёк',exact:true})
  await expect(dialog).toBeVisible()
  await expect(page.locator('.ms-sheet')).toHaveCount(0)
  const card=await dialog.locator('.am-card').boundingBox()
  expect(card.width).toBeLessThanOrEqual(360)
  expect(card.x).toBeGreaterThanOrEqual(11)
  expect(card.x+card.width).toBeLessThanOrEqual(width-11)
  await dialog.getByRole('button',{name:'5',exact:true}).click()
  await dialog.getByRole('button',{name:'Взять',exact:true}).click()
  await expect.poll(()=>api.document().values.money.amounts[1]).toBe(15)
  await dialog.screenshot({path:testInfo.outputPath('money-dialog.png'),animations:'disabled'})
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
})
