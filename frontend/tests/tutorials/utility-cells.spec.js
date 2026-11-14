import { expect, test } from '@playwright/test'

async function openMenu(page) {
  await page.getByRole('button',{name:'Действия персонажа',exact:true}).click()
  return page.getByRole('menu',{name:'Действия персонажа',exact:true})
}

for(const width of [390,834,1440])test(`character menu owns utility values and editors at ${width}`,async({page},info)=>{
  page.on('pageerror',error=>{throw error})
  await page.setViewportSize({width,height:900})
  await page.goto('/tests/tutorials/fixtures/utility-cells.html')
  await expect(page.locator('.dnd-utility-grid .utility-cell')).toHaveCount(1)
  for(const id of ['speed','initiative','prof_bonus'])await expect(page.locator(`.test-utilities [data-sheet-field="${id}"]`)).toHaveCount(0)
  let menu=await openMenu(page)
  await expect(menu.getByRole('menuitem',{name:/^Скорость/})).toContainText('25 фт')
  await expect(menu.getByRole('menuitem',{name:/^Инициатива/})).toContainText('+5')
  await expect(menu.getByRole('menuitem',{name:/^Мастерство/})).toContainText('+3')
  await expect(menu).toHaveCSS('opacity','1')
  await info.attach('character-menu-values',{body:await page.screenshot(),contentType:'image/png'})
  await menu.getByRole('menuitem',{name:/^Скорость/}).click()
  await expect(page.getByRole('dialog',{name:'Скорость',exact:true})).toBeVisible()
  await expect(page.getByRole('menu')).toHaveCount(0)
  await page.keyboard.press('Escape')
  for(const [label,title]of [['Инициатива','Инициатива'],['Мастерство','Бонус владения']]){
    menu=await openMenu(page)
    await menu.getByRole('menuitem',{name:new RegExp('^'+label)}).click()
    await page.getByRole('menuitem',{name:'Изменить',exact:true}).click()
    await expect(page.getByRole('dialog',{name:title,exact:true})).toBeVisible()
    await expect(page.getByRole('menu')).toHaveCount(0)
    await page.keyboard.press('Escape')
  }
  expect(await page.evaluate(()=>window.writes)).toEqual([])
})

for(const readonly of [false,true])test(`utility rolls and readonly permissions (${readonly?'reader':'owner'})`,async({page})=>{
  page.on('pageerror',error=>{throw error})
  await page.setViewportSize({width:834,height:900})
  await page.goto('/tests/tutorials/fixtures/utility-cells.html'+(readonly?'?readonly':''))
  for(const [index,label]of ['Инициатива','Мастерство'].entries()){
    const menu=await openMenu(page)
    await menu.getByRole('menuitem',{name:new RegExp('^'+label)}).click()
    await expect(page.getByRole('menuitem',{name:'Изменить',exact:true})).toHaveCount(readonly?0:1)
    expect(await page.evaluate(()=>window.rolls.length)).toBe(index)
    await page.getByRole('menuitem',{name:'Бросить кубик',exact:true}).click()
    await expect(page.getByRole('menu')).toHaveCount(0)
    expect(await page.evaluate(()=>window.rolls.length)).toBe(index+1)
  }
  const rolls=await page.evaluate(()=>window.rolls)
  expect(rolls[0]).toMatchObject({kind:'d20',args:['Инициатива',5,'normal',{eventData:{sheetInitiative:true},crit_mode:true}]})
  const menu=await openMenu(page)
  if(readonly)await expect(menu.getByRole('menuitem',{name:/^Скорость/})).toBeDisabled()
  await page.evaluate(()=>{window.utilityValues.lvl.level=9})
  await expect(menu.getByRole('menuitem',{name:/^Мастерство/})).toContainText('+4')
  const writes=await page.evaluate(()=>window.writes)
  expect(writes.filter(patch=>patch.id==='prof_bonus')).toHaveLength(readonly?0:1)
})

test('speed changes remain live after moving the editor into the header',async({page})=>{
  await page.goto('/tests/tutorials/fixtures/utility-cells.html')
  await (await openMenu(page)).getByRole('menuitem',{name:/^Скорость/}).click()
  const dialog=page.getByRole('dialog',{name:'Скорость',exact:true})
  const input=dialog.locator('input').first()
  await input.fill('35')
  await input.press('Tab')
  await expect.poll(()=>page.evaluate(()=>window.utilityValues.speed.base)).toBe(35)
  await page.keyboard.press('Escape')
  await expect((await openMenu(page)).getByRole('menuitem',{name:/^Скорость/})).toContainText('30 фт')
})
