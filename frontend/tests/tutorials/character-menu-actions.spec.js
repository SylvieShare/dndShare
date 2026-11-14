import { test, expect } from '@playwright/test'
import { weaponSheetFixture } from './fixtures/weapon-sheet'

async function prepare(page,width,owner=true){
  await page.setViewportSize({width,height:1000})
  await page.emulateMedia({reducedMotion:'reduce'})
  const api=await weaponSheetFixture(page,owner)
  api.catalogue[206]={id:206,typeId:6,name:'Пробное заклинание',data:{lvl:1,time:{kind:'action'},range:{kind:'ranged',distance:60},components:{v:true},desc:'Описание заклинания'}}
  api.catalogue[302]={id:302,typeId:2,name:'Походный фонарь',data:{desc:'Описание фонаря'}}
  api.catalogue[950]={id:950,typeId:15,name:'Пробное состояние',data:{desc:'Описание состояния'}}
  api.document().values.spells={schema_version:2,tabs:[{key:'book',name:'Книга',casting_ability:4,mode:'spellbook',spells:[{key:'spell',id:206}]}],grants:[]}
  api.document().values.items={equipped:[],sections:[{id:'bag',name:'Рюкзак',items:[{uid:'lantern',item_id:302,count:2},{uid:'note',count:1,override:{name:'Записка'}}]}]}
  api.document().values.states=[{uid:'state',effect_id:950,duration:{kind:'manual'}}]
  await page.goto('/char/test?tab=weapons',{waitUntil:'networkidle'})
  return api
}
async function checkBar(menu,labels){
  const bar=menu.getByRole('group',{name:'Действия с объектом',exact:true})
  await expect(bar).toBeVisible()
  await expect(bar.getByRole('button')).toHaveCount(labels.length)
  for(const label of labels){
    const button=bar.getByRole('button',{name:label,exact:true})
    await expect(button).toBeVisible()
    await expect(button.locator('svg')).toHaveCount(1)
    expect((await button.textContent()).trim()).toBe('')
    const box=await button.boundingBox()
    expect(Math.abs(box.width-box.height)).toBeLessThan(1)
  }
  const geometry=await bar.evaluate(node=>({right:node.getBoundingClientRect().right,last:node.lastElementChild.getBoundingClientRect().right}))
  expect(geometry.right-geometry.last).toBeLessThanOrEqual(9)
  return bar
}
for(const width of [390,834,1440]) test(`character menus share icon action bars and retain previews at ${width}`,async({page},info)=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message))
  const api=await prepare(page,width)
  const weapon=page.locator('.w-card:visible').first()
  await weapon.locator('.w-name').click()
  let menu=page.getByRole('menu',{name:'Действия: Тестовое копьё',exact:true})
  await checkBar(menu,['Открыть описание','Изменить','Удалить'])
  await expect(menu.locator('.ram-heading')).toHaveCount(0)
  await menu.screenshot({path:info.outputPath('weapon-menu.png'),animations:'disabled'})
  await menu.getByRole('button',{name:'Открыть описание',exact:true}).click()
  await expect(page.getByRole('dialog').last()).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await weapon.locator('.w-name').click()
  await menu.getByRole('button',{name:'Изменить',exact:true}).click()
  await expect(page.locator('.mes-editor')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.locator('.mes-editor')).toHaveCount(0)
  await weapon.locator('.w-name').click()
  await menu.getByRole('button',{name:'Удалить',exact:true}).click()
  await expect.poll(()=>api.document().values.weapon.length).toBe(0)

  await page.getByRole('button',{name:'Магия',exact:true}).click()
  await page.locator('.spell-row:visible').filter({hasText:'Пробное заклинание'}).locator('.sp-name').click()
  menu=page.getByRole('menu',{name:'Действия: Пробное заклинание',exact:true})
  await checkBar(menu,['Открыть описание','Удалить'])
  await expect(menu.locator('.ram-heading')).toHaveCount(0)
  await menu.screenshot({path:info.outputPath('spell-menu.png'),animations:'disabled'})
  await page.keyboard.press('Escape')

  await page.getByRole('button',{name:width>=1200?'Снаряжение':'Предметы',exact:true}).click()
  await page.getByRole('button',{name:'Походный фонарь',exact:true}).click()
  menu=page.getByRole('menu',{name:'Действия: Походный фонарь',exact:true})
  const bar=await checkBar(menu,['Открыть описание','Удалить предмет'])
  await expect(menu.locator('.inventory-menu-name')).toHaveCount(0)
  expect((await menu.getByText('Количество: 2',{exact:true}).boundingBox()).y).toBeLessThan((await bar.boundingBox()).y)
  await expect(menu.getByRole('menuitem',{name:'Уменьшить на 1',exact:true})).toBeVisible()
  await menu.screenshot({path:info.outputPath('inventory-menu.png'),animations:'disabled'})
  await page.keyboard.press('Escape')
  await page.getByRole('button',{name:'Записка',exact:true}).click()
  await checkBar(page.getByRole('menu',{name:'Действия: Записка',exact:true}),['Изменить','Удалить предмет'])
  await page.keyboard.press('Escape')

  if(width<1200) await page.getByRole('button',{name:'Статы',exact:true}).click()
  await page.getByRole('button',{name:'Сила — проверка',exact:true}).click()
  menu=page.getByRole('menu',{name:'Сила — проверка',exact:true})
  await checkBar(menu,['Изменить'])
  const previewOrder=await menu.evaluate(node=>node.querySelector('.character-menu-actions').getBoundingClientRect().top-node.querySelector('.stat-roll-summary').getBoundingClientRect().bottom)
  expect(previewOrder).toBeGreaterThanOrEqual(0)
  await expect(menu.locator('.stat-roll-summary')).toContainText('Сила — проверка')
  await menu.screenshot({path:info.outputPath('stat-menu.png'),animations:'disabled'})
  await page.keyboard.press('Escape')
  await page.getByRole('button',{name:'Пробное состояние',exact:true}).click()
  menu=page.getByRole('menu',{name:'Действия: Пробное состояние',exact:true})
  await checkBar(menu,['Посмотреть','Изменить длительность','Убрать'])
  await page.keyboard.press('Escape')
  expect(errors).toEqual([])
})

test('reader menus expose reference actions without edit or removal',async({page})=>{
  const api=await prepare(page,834,false)
  await page.locator('.w-card:visible').first().locator('.w-name').click()
  const menu=page.getByRole('menu',{name:'Действия: Тестовое копьё',exact:true})
  await checkBar(menu,['Открыть описание'])
  expect(api.writes).toEqual([])
})
