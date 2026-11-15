import { expect, test } from '@playwright/test'

async function openMenu(page) {
  await page.getByRole('button',{name:'Действия персонажа',exact:true}).click()
  return page.getByRole('menu',{name:'Действия персонажа',exact:true})
}
const metrics=[['Скорость','25 фт','Скорость'],['Инициатива','+5','Инициатива'],['Мастерство','+3','Бонус владения'],['КД','16','Класс доспеха']]

for(const width of [320,390,834,1440])test(`header metric group and direct dialogs at ${width}`,async({page},info)=>{
  page.on('pageerror',error=>{throw error})
  await page.setViewportSize({width,height:900})
  await page.goto('/tests/tutorials/fixtures/utility-cells.html')
  const group=page.getByRole('group',{name:'Показатели персонажа',exact:true})
  await expect(group).toBeVisible()
  expect(await group.locator('[data-header-metric]').evaluateAll(nodes=>nodes.map(node=>node.dataset.headerMetric))).toEqual(['armor','speed','initiative','proficiency','dice'])
  for(const [label,value]of metrics){
    const control=group.getByRole('button',{name:label,exact:true})
    await expect(control.locator('strong')).toHaveText(value.replace(' фт',''))
    await expect(control).toHaveAccessibleDescription(value)
  }
  const bounds=await group.boundingBox()
  expect(bounds.x).toBeGreaterThanOrEqual(0)
  expect(bounds.x+bounds.width).toBeLessThanOrEqual(width)
  const cells=group.locator('[data-header-metric]')
  const boxes=await cells.evaluateAll(nodes=>nodes.map(node=>{const r=node.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height}}))
  expect(boxes.every(box=>Math.abs(box.y-boxes[0].y)<1)).toBe(true)
  expect(boxes.every((box,index)=>!index||box.x>=boxes[index-1].x+boxes[index-1].width-.5)).toBe(true)
  await expect(group.locator('.workspace-row-divider')).toHaveCount(4)
  let menu=await openMenu(page)
  await expect(menu.getByRole('group',{name:'Показатели персонажа'})).toHaveCount(0)
  const hp=menu.getByRole('menuitem',{name:/^Изменить HP/})
  await expect(hp.getByRole('group')).toHaveAttribute('aria-label','Здоровье: 12 из 18, временные 5')
  await expect(hp.locator('button')).toHaveCount(0)
  await info.attach('header-metric-group',{body:await page.screenshot(),contentType:'image/png'})
  await page.keyboard.press('Escape')
  for(const [label,,title]of metrics){
    await group.getByRole('button',{name:label,exact:true}).click()
    await expect(page.getByRole('dialog',{name:title,exact:true})).toBeVisible()
    await expect(page.getByRole('menu')).toHaveCount(0)
    await page.keyboard.press('Escape')
  }
  menu=await openMenu(page)
  await menu.getByRole('menuitem',{name:/^Изменить HP/}).click()
  await expect(page.getByRole('dialog',{name:'Здоровье',exact:true})).toBeVisible()
  expect(await page.evaluate(()=>window.writes)).toEqual([])
})

for(const readonly of [false,true])test(`utility dialog rolls and permissions (${readonly?'reader':'owner'})`,async({page})=>{
  page.on('pageerror',error=>{throw error})
  await page.setViewportSize({width:834,height:900})
  await page.goto('/tests/tutorials/fixtures/utility-cells.html'+(readonly?'?readonly':''))
  for(const [index,[label,,title]]of metrics.slice(1,3).entries()){
    await page.getByRole('group',{name:'Показатели персонажа',exact:true}).getByRole('button',{name:label,exact:true}).click()
    const dialog=page.getByRole('dialog',{name:title,exact:true})
    await expect(dialog).toBeVisible()
    await expect(page.getByRole('menu')).toHaveCount(0)
    if(readonly)await expect(dialog.locator('input')).toHaveCount(0)
    expect(await page.evaluate(()=>window.rolls.length)).toBe(index)
    await dialog.getByRole('button',{name:'Бросить кубик',exact:true}).click()
    await expect(dialog).toHaveCount(0)
    expect(await page.evaluate(()=>window.rolls.length)).toBe(index+1)
  }
  const rolls=await page.evaluate(()=>window.rolls)
  expect(rolls[0]).toMatchObject({kind:'d20',args:['Инициатива',5,'normal',{eventData:{sheetInitiative:true},crit_mode:true}]})
  const group=page.getByRole('group',{name:'Показатели персонажа',exact:true})
  if(readonly)for(const label of ['Скорость','КД'])await expect(group.getByRole('button',{name:label,exact:true})).toBeDisabled()
  await page.evaluate(()=>{window.utilityValues.lvl.level=9})
  await expect(group.getByRole('button',{name:'Мастерство',exact:true})).toContainText('+4')
  const writes=await page.evaluate(()=>window.writes)
  expect(writes.filter(patch=>patch.id==='prof_bonus')).toHaveLength(readonly?0:1)
})

test('speed stays live in the header and health stays live in its menu',async({page})=>{
  await page.goto('/tests/tutorials/fixtures/utility-cells.html')
  const speed=page.getByRole('group',{name:'Показатели персонажа',exact:true}).getByRole('button',{name:'Скорость',exact:true})
  await speed.click()
  const input=page.getByRole('dialog',{name:'Скорость',exact:true}).locator('input').first()
  await input.fill('35')
  await input.press('Tab')
  await expect.poll(()=>page.evaluate(()=>window.utilityValues.speed.base)).toBe(35)
  await page.keyboard.press('Escape')
  await expect(speed.locator('strong')).toHaveText('30')
  const menu=await openMenu(page)
  await page.evaluate(()=>{window.utilityValues.hp.current=7;window.utilityValues.hp.temp=0})
  await expect(menu.getByRole('menuitem',{name:/^Изменить HP/}).getByRole('group')).toHaveAttribute('aria-label','Здоровье: 7 из 18')
})

for(const readonly of [false,true])test(`header dice menu rolls every standard die (${readonly?'reader':'owner'})`,async({page})=>{
  await page.goto('/tests/tutorials/fixtures/utility-cells.html'+(readonly?'?readonly':''))
  const sides=[4,6,8,10,12,20,100]
  for(const [index,side]of sides.entries()){
    await page.getByRole('button',{name:'Кубики персонажа',exact:true}).click()
    const menu=page.getByRole('menu',{name:'Кубики',exact:true})
    await expect(menu.getByRole('menuitem')).toHaveCount(7)
    await menu.getByRole('menuitem',{name:`Бросить d${side}`,exact:true}).click()
    await expect(menu).toHaveCount(0)
    expect(await page.evaluate(()=>window.rolls.at(-1))).toMatchObject({kind:'roll',args:[`d${side}`,`d${side}`,{crit_mode:side===20}]})
    expect(await page.evaluate(()=>window.rolls.length)).toBe(index+1)
  }
})
